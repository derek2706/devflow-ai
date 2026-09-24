import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import type { PrismaClientOrTransaction } from "../src/lib/prisma.types";
import { ApiError } from "../src/shared/errors/ApiError";
import {
  requireProjectAccess,
  requireWorkspaceMember,
} from "../src/shared/authorization";
import { prisma } from "../src/lib/prisma";
import projectsService from "../src/modules/projects/projects.service";
import projectsRepository from "../src/modules/projects/projects.repository";
import tasksService, {
  reorderTaskIds,
} from "../src/modules/tasks/tasks.service";
import tasksRepository from "../src/modules/tasks/tasks.repository";
import workspacesService from "../src/modules/workspaces/workspaces.service";
import workspacesRepository from "../src/modules/workspaces/workspaces.repository";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  commentSchema,
} from "../src/modules/tasks/tasks.validation";
import { updateColumnSchema } from "../src/modules/projects/projects.validation";
import {
  memberRoleSchema,
  invitationSchema,
} from "../src/modules/workspaces/workspaces.validation";

const userId = randomUUID();
const workspaceId = randomUUID();
const projectId = randomUUID();
const project = { id: projectId, workspaceId, createdById: userId };
function fakeDb(
  options: {
    role?: string;
    projectMember?: boolean;
    projectExists?: boolean;
    creator?: string;
  } = {},
): PrismaClientOrTransaction {
  return {
    workspaceMember: {
      findUnique: async () =>
        options.role ? { userId, workspaceId, role: options.role } : null,
    },
    project: {
      findUnique: async () =>
        options.projectExists === false
          ? null
          : { ...project, createdById: options.creator ?? userId },
    },
    projectMember: {
      findUnique: async () =>
        options.projectMember ? { userId, projectId } : null,
    },
  } as unknown as PrismaClientOrTransaction;
}
function override(
  context: TestContext,
  target: any,
  method: string,
  replacement: any,
) {
  // Prisma delegates are dynamic proxies; Node's mock.method cannot inspect their methods.
  const original = target[method];
  target[method] = replacement;
  context.after(() => {
    target[method] = original;
  });
}
const rejectsWithStatus = (status: number) => (error: unknown) =>
  error instanceof ApiError && error.statusCode === status;

test("workspace access conceals workspaces from nonmembers", async () => {
  await assert.rejects(
    requireWorkspaceMember(fakeDb(), workspaceId, userId),
    rejectsWithStatus(404),
  );
});

test("project membership never bypasses workspace membership", async () => {
  await assert.rejects(
    requireProjectAccess(fakeDb({ projectMember: true }), projectId, userId),
    rejectsWithStatus(404),
  );
});

test("workspace members cannot read a project they have not joined", async () => {
  await assert.rejects(
    requireProjectAccess(fakeDb({ role: "MEMBER" }), projectId, userId),
    rejectsWithStatus(404),
  );
});

test("workspace administrators can manage all projects", async () => {
  for (const role of ["ADMIN", "OWNER"]) {
    const result = await requireProjectAccess(
      fakeDb({ role, creator: randomUUID() }),
      projectId,
      userId,
      true,
    );
    assert.equal(result.workspaceMember.role, role);
  }
});

test("a project member can collaborate but cannot manage another creator's project", async () => {
  const db = fakeDb({
    role: "MEMBER",
    projectMember: true,
    creator: randomUUID(),
  });
  assert.equal(
    (await requireProjectAccess(db, projectId, userId)).project.id,
    projectId,
  );
  await assert.rejects(
    requireProjectAccess(db, projectId, userId, true),
    rejectsWithStatus(403),
  );
});

test("a project creator with workspace and project membership can manage their project", async () => {
  assert.equal(
    (
      await requireProjectAccess(
        fakeDb({ role: "MEMBER", projectMember: true }),
        projectId,
        userId,
        true,
      )
    ).project.createdById,
    userId,
  );
});

test("a missing project returns not found", async () => {
  await assert.rejects(
    requireProjectAccess(
      fakeDb({ role: "OWNER", projectExists: false }),
      projectId,
      userId,
    ),
    rejectsWithStatus(404),
  );
});

test("task moves preserve distinct tasks and requested index", () => {
  const items = ["a", "b", "c", "d"].map((id) => ({ id }));
  assert.deepEqual(reorderTaskIds(items, "a", 2), ["b", "c", "a", "d"]);
  assert.deepEqual(reorderTaskIds(items, "d", 0), ["d", "a", "b", "c"]);
  assert.deepEqual(reorderTaskIds(items, "b", 1), ["a", "b", "c", "d"]);
  assert.deepEqual(
    items.map((item) => item.id),
    ["a", "b", "c", "d"],
  );
});

test("cross-column moves support empty destinations and clamp the last position", () => {
  assert.deepEqual(reorderTaskIds([], "a", 99), ["a"]);
  assert.deepEqual(reorderTaskIds([{ id: "b" }, { id: "c" }], "a", 99), [
    "b",
    "c",
    "a",
  ]);
});

test("task input normalizes labels and rejects unknown project/creator ownership fields", () => {
  const input = {
    title: " Test task ",
    columnId: randomUUID(),
    labels: ["bug", "bug", "frontend"],
  };
  const parsed = createTaskSchema.parse(input);
  assert.equal(parsed.title, "Test task");
  assert.equal(parsed.priority, "MEDIUM");
  assert.deepEqual(parsed.labels, ["bug", "frontend"]);
  assert.equal(
    createTaskSchema.safeParse({ ...input, projectId: randomUUID() }).success,
    false,
  );
  assert.equal(
    createTaskSchema.safeParse({ ...input, createdById: randomUUID() }).success,
    false,
  );
});

test("task edits validate deadlines and reserve status changes for the move endpoint", () => {
  assert.equal(
    updateTaskSchema.safeParse({ dueDate: "2026-09-24T10:00:00.000Z" }).success,
    true,
  );
  assert.equal(
    updateTaskSchema.safeParse({ dueDate: null, assigneeId: null }).success,
    true,
  );
  assert.equal(
    updateTaskSchema.safeParse({ dueDate: "tomorrow" }).success,
    false,
  );
  assert.equal(
    updateTaskSchema.safeParse({ columnId: randomUUID() }).success,
    false,
  );
  assert.equal(updateTaskSchema.safeParse({}).success, false);
  assert.equal(
    moveTaskSchema.safeParse({ columnId: randomUUID(), position: -1 }).success,
    false,
  );
  assert.equal(
    moveTaskSchema.safeParse({ columnId: randomUUID(), position: 1.5 }).success,
    false,
  );
});

test("role changes and invitations cannot create another owner", () => {
  assert.equal(memberRoleSchema.safeParse({ role: "OWNER" }).success, false);
  assert.equal(
    invitationSchema.safeParse({ email: "test@example.com", role: "OWNER" })
      .success,
    false,
  );
  assert.equal(
    invitationSchema.parse({ email: "TEST@EXAMPLE.COM" }).email,
    "test@example.com",
  );
});

test("column updates accept completion status and reject empty or invalid moves", () => {
  assert.equal(
    updateColumnSchema.safeParse({ isDone: true, position: 0 }).success,
    true,
  );
  assert.equal(updateColumnSchema.safeParse({ position: -1 }).success, false);
  assert.equal(updateColumnSchema.safeParse({}).success, false);
  assert.equal(commentSchema.safeParse({ content: "   " }).success, false);
});

test("project collaborators cannot change project settings or board structure", async (context) => {
  override(context, prisma.project, "findUnique", async () => ({
    ...project,
    createdById: randomUUID(),
  }));
  override(context, prisma.workspaceMember, "findUnique", async () => ({
    userId,
    workspaceId,
    role: "MEMBER",
  }));
  override(context, prisma.projectMember, "findUnique", async () => ({
    userId,
    projectId,
  }));
  const columnId = randomUUID();
  context.mock.method(projectsRepository, "column", async () => ({
    id: columnId,
    projectId,
    name: "To do",
    position: 0,
    isDone: false,
    createdAt: new Date(),
    _count: { tasks: 0 },
  }));
  const operations = [
    () =>
      projectsService.update(userId, projectId, { name: "Unauthorized edit" }),
    () => projectsService.delete(userId, projectId),
    () =>
      projectsService.createColumn(userId, projectId, {
        name: "Unauthorized column",
        isDone: false,
      }),
    () =>
      projectsService.updateColumn(userId, columnId, {
        name: "Unauthorized rename",
      }),
    () => projectsService.deleteColumn(userId, columnId),
    () => projectsService.addMember(userId, projectId, randomUUID()),
    () => projectsService.removeMember(userId, projectId, randomUUID()),
  ];
  for (const operation of operations)
    await assert.rejects(operation(), rejectsWithStatus(403));
});

test("moving a task preserves sibling timestamps and only reindexes affected positions", async (context) => {
  const source = randomUUID();
  const destination = randomUUID();
  const oldDate = new Date("2020-01-01T00:00:00Z");
  const tasks = [
    {
      id: "moving",
      projectId,
      columnId: source,
      position: 0,
      title: "Moving",
      updatedAt: oldDate,
    },
    {
      id: "source-sibling",
      projectId,
      columnId: source,
      position: 1,
      title: "Source",
      updatedAt: oldDate,
    },
    {
      id: "target-first",
      projectId,
      columnId: destination,
      position: 0,
      title: "First",
      updatedAt: oldDate,
    },
    {
      id: "target-last",
      projectId,
      columnId: destination,
      position: 1,
      title: "Last",
      updatedAt: oldDate,
    },
  ];
  override(context, prisma, "$transaction", async (callback: any) =>
    callback(prisma),
  );
  override(context, prisma.project, "findUnique", async () => project);
  override(context, prisma.workspaceMember, "findUnique", async () => ({
    userId,
    workspaceId,
    role: "OWNER",
  }));
  override(context, prisma.activity, "create", async () => ({}));
  context.mock.method(tasksRepository, "lockProject", async () => []);
  context.mock.method(
    tasksRepository,
    "get",
    async (_db: any, id: string) =>
      ({ ...tasks.find((task) => task.id === id) }) as any,
  );
  context.mock.method(
    tasksRepository,
    "column",
    async () => ({ id: destination, projectId, name: "Done" }) as any,
  );
  context.mock.method(
    tasksRepository,
    "columnTasks",
    async (_db: any, columnId: string) =>
      tasks
        .filter((task) => task.columnId === columnId)
        .sort((a, b) => a.position - b.position)
        .map((task) => ({ ...task })),
  );
  const changedTasks: string[] = [];
  const reindexed: string[] = [];
  context.mock.method(
    tasksRepository,
    "update",
    async (_db: any, id: string, data: any) => {
      changedTasks.push(id);
      const task = tasks.find((task) => task.id === id)!;
      Object.assign(task, data, { updatedAt: new Date() });
      return task as any;
    },
  );
  context.mock.method(
    tasksRepository,
    "reposition",
    async (_db: any, id: string, position: number, updatedAt: Date) => {
      reindexed.push(id);
      const task = tasks.find((task) => task.id === id)!;
      Object.assign(task, { position, updatedAt });
      return task as any;
    },
  );
  await tasksService.move(userId, "moving", {
    columnId: destination,
    position: 1,
  });
  assert.deepEqual(changedTasks, ["moving"]);
  assert.deepEqual(reindexed.sort(), ["source-sibling", "target-last"]);
  assert.deepEqual(
    tasks
      .filter((task) => task.columnId === destination)
      .sort((a, b) => a.position - b.position)
      .map((task) => task.id),
    ["target-first", "moving", "target-last"],
  );
  assert.equal(tasks.find((task) => task.id === "source-sibling")!.position, 0);
  for (const task of tasks.filter((task) => task.id !== "moving"))
    assert.equal(task.updatedAt.toISOString(), oldDate.toISOString());
  const movedAt = tasks.find((task) => task.id === "moving")!.updatedAt;
  await tasksService.move(userId, "moving", {
    columnId: destination,
    position: 0,
  });
  assert.deepEqual(changedTasks, ["moving"]);
  assert.equal(tasks.find((task) => task.id === "moving")!.updatedAt, movedAt);
});

test("a queued task edit rechecks membership after acquiring its transaction lock", async (context) => {
  let member = true;
  override(context, prisma, "$transaction", async (callback: any) =>
    callback(prisma),
  );
  override(context, prisma.project, "findUnique", async () => project);
  override(context, prisma.workspaceMember, "findUnique", async () =>
    member ? { userId, workspaceId, role: "OWNER" } : null,
  );
  context.mock.method(
    tasksRepository,
    "get",
    async () => ({ id: "task", projectId, title: "Task" }) as any,
  );
  context.mock.method(tasksRepository, "lockProject", async () => {
    member = false;
    return [];
  });
  const update = context.mock.method(tasksRepository, "update", async () => {
    throw new Error("Unauthorized write");
  });
  await assert.rejects(
    tasksService.update(userId, "task", { title: "No access" }),
    rejectsWithStatus(404),
  );
  assert.equal(update.mock.callCount(), 0);
});

test("pending invitations cannot be accepted after their inviter loses administrator access", async (context) => {
  const invitation = {
    id: randomUUID(),
    workspaceId,
    workspace: { id: workspaceId },
    invitedById: randomUUID(),
    email: "member@example.com",
    role: "ADMIN",
    acceptedAt: null,
    expiresAt: new Date(Date.now() + 60000),
  };
  override(context, prisma, "$transaction", async (callback: any) =>
    callback(prisma),
  );
  context.mock.method(
    workspacesRepository,
    "invitation",
    async () => invitation as any,
  );
  context.mock.method(workspacesRepository, "lockWorkspace", async () => []);
  context.mock.method(
    workspacesRepository,
    "member",
    async () => ({ role: "MEMBER" }) as any,
  );
  const join = context.mock.method(workspacesRepository, "join", async () => {
    throw new Error("Unauthorized role grant");
  });
  await assert.rejects(
    workspacesService.accept(userId, "a".repeat(64)),
    rejectsWithStatus(400),
  );
  assert.equal(join.mock.callCount(), 0);
});
