import assert from "node:assert/strict";
import { beforeEach, test, type TestContext } from "node:test";
import { prisma } from "../src/lib/prisma";
import { ApiError } from "../src/shared/errors/ApiError";
import service from "../src/modules/ai/ai.service";
import repository from "../src/modules/ai/ai.repository";
import { AiProviderFailure } from "../src/modules/ai/ai.provider";
import {
  taskContext,
  MAX_PROVIDER_CONTEXT_CHARACTERS,
} from "../src/modules/ai/ai.context";
import { summaryResult, sprintResult } from "../src/modules/ai/ai.validation";
import type { PlanningTask } from "../src/modules/ai/ai.planner";

const userId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";
const summary = { summary: "One task remains.", highlights: [], risks: [] };

beforeEach(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
    JWT_ACCESS_SECRET: "service-test-access-secret-at-least-32-characters",
    JWT_REFRESH_SECRET: "service-test-refresh-secret-at-least-32-characters",
    AI_MODE: "provider",
    AI_PROVIDER: "groq",
    GROQ_API_KEY: "synthetic-service-provider-key",
    GROQ_MODEL: "openai/gpt-oss-120b",
  });
});

function task(index: number, values: Partial<PlanningTask> = {}): PlanningTask {
  return {
    id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
    title: `Stored task ${index}`,
    description: "Task details",
    priority: "MEDIUM",
    dueDate: null,
    updatedAt: new Date("2026-09-24T12:00:00Z"),
    column: { name: "To do", isDone: false },
    ...values,
  };
}

function completion(result: unknown) {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(result) }],
        },
      ],
    }),
  );
}

function override(
  t: TestContext,
  target: any,
  method: string,
  replacement: any,
) {
  // Prisma delegates are proxies that cannot be inspected by mock.method.
  const original = target[method];
  target[method] = replacement;
  t.after(() => {
    target[method] = original;
  });
}

function accessibleProject(
  t: TestContext,
  tasks: PlanningTask[],
  role = "OWNER",
) {
  override(t, prisma.project, "findUnique", async () => ({
    id: projectId,
    workspaceId,
    createdById: userId,
  }));
  override(t, prisma.workspaceMember, "findUnique", async () => ({
    userId,
    workspaceId,
    role,
  }));
  override(t, prisma.projectMember, "findUnique", async () => ({
    userId,
    projectId,
  }));
  t.mock.method(
    repository,
    "projectContext",
    async () =>
      ({
        name: "Synthetic project",
        description: "Synthetic description",
        tasks,
        _count: { tasks: tasks.length },
      }) as any,
  );
}

test("configured local mode makes no provider request or claim of external generation", async (t) => {
  process.env.AI_MODE = "local";
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  const result = await service.generate(
    summaryResult,
    "summary",
    "Summarize",
    { tasks: [] },
    () => summary,
  );
  assert.deepEqual(service.status(), { mode: "local" });
  assert.equal(result.mode, "local");
  assert.equal(result.provider, undefined);
  assert.equal(result.model, undefined);
  assert.equal(result.fallbackReason, undefined);
  assert.deepEqual(result.result, summary);
  assert.equal(fetch.mock.callCount(), 0);
});

test("successful generation reports Groq provenance without invoking local fallback", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    completion(summary),
  );
  const result = await service.generate(
    summaryResult,
    "summary",
    "Summarize",
    { tasks: [] },
    () => {
      throw new Error("Local fallback must not run");
    },
  );
  assert.deepEqual(service.status(), {
    mode: "provider",
    provider: "groq",
    model: "openai/gpt-oss-120b",
  });
  assert.equal(result.mode, "provider");
  assert.equal(result.provider, "groq");
  assert.equal(result.model, "openai/gpt-oss-120b");
  assert.equal(result.fallbackReason, undefined);
  assert.deepEqual(result.result, summary);
  assert.equal(fetch.mock.callCount(), 1);
  assert.ok(!JSON.stringify(result).includes("synthetic-service-provider-key"));
});

for (const reason of [
  "quota",
  "unavailable",
  "timeout",
  "invalid_response",
] as const) {
  test(
    reason +
      " returns a validated local draft with truthful attempted provider metadata",
    async (t) => {
      const fetch = t.mock.method(globalThis, "fetch", async () => {
        if (reason === "quota")
          return new Response("private upstream data", { status: 429 });
        if (reason === "unavailable")
          return new Response("private upstream data", { status: 503 });
        if (reason === "timeout")
          throw new DOMException("private timeout", "TimeoutError");
        return completion({ summary: false });
      });
      let calls = 0;
      const result = await service.generate(
        summaryResult,
        "summary",
        "Summarize",
        { tasks: [] },
        () => {
          calls++;
          return summary;
        },
      );
      assert.equal(result.mode, "local");
      assert.equal(result.provider, "groq");
      assert.equal(result.model, "openai/gpt-oss-120b");
      assert.equal(result.fallbackReason, reason);
      assert.deepEqual(result.result, summary);
      assert.equal(calls, 1);
      assert.equal(fetch.mock.callCount(), 1);
      assert.ok(!JSON.stringify(result).includes("private upstream"));
    },
  );
}

test("configuration errors do not silently invoke the local planner", async (t) => {
  let status = 401;
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("private error", { status }),
  );
  const generate = () =>
    service.generate(
      summaryResult,
      "summary",
      "Summarize",
      { tasks: [] },
      () => {
        throw new Error("Local fallback must not run");
      },
    );
  for (const code of [400, 401, 403, 404]) {
    status = code;
    await assert.rejects(
      generate(),
      (error: unknown) =>
        error instanceof ApiError && !(error instanceof AiProviderFailure),
    );
  }
  delete process.env.GROQ_API_KEY;
  await assert.rejects(generate(), /GROQ_API_KEY/);
  assert.equal(fetch.mock.callCount(), 4);
});

test("authorization failures prevent every scoped generation before any provider call", async (t) => {
  override(t, prisma.project, "findUnique", async () => ({
    id: projectId,
    workspaceId,
  }));
  override(t, prisma.workspaceMember, "findUnique", async () => null);
  t.mock.method(
    repository,
    "findTask",
    async () => ({ ...task(1), projectId }) as any,
  );
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  for (const operation of [
    () => service.subtasks(userId, task(1).id),
    () => service.projectSummary(userId, projectId),
    () => service.sprintPlan(userId, { projectId, capacity: 3 }),
    () => service.standup(userId, { workspaceId }),
  ])
    await assert.rejects(
      operation(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 404,
    );
  assert.equal(fetch.mock.callCount(), 0);
});

test("database failures propagate without egress or a misleading fallback", async (t) => {
  accessibleProject(t, []);
  const failure = new Error("synthetic database failure");
  t.mock.method(repository, "projectContext", async () => {
    throw failure;
  });
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  await assert.rejects(
    service.projectSummary(userId, projectId),
    (error) => error === failure,
  );
  assert.equal(fetch.mock.callCount(), 0);
});

test("project requests use bounded projected content and preserve truthful sampling metadata", async (t) => {
  const tasks = Array.from({ length: 200 }, (_, index) => ({
    ...task(index, { description: '"\\\n'.repeat(4000) }),
    comments: [{ content: "private comment marker" }],
    user: { email: "private@example.test" },
  }));
  accessibleProject(t, tasks);
  let sentCount = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.ok(request.input.length <= MAX_PROVIDER_CONTEXT_CHARACTERS);
    const context = JSON.parse(request.input);
    sentCount = context.tasks.length;
    assert.ok(sentCount > 0 && sentCount < 200);
    assert.ok(
      context.tasks.every((item: any) => item.description.length <= 500),
    );
    assert.ok(!request.input.includes("private comment marker"));
    assert.ok(!request.input.includes("private@example.test"));
    return completion(summary);
  });
  const result = await service.projectSummary(userId, projectId);
  assert.equal(result.mode, "provider");
  assert.equal(result.contextLimited, true);
  assert.match(
    result.result.summary,
    new RegExp("latest " + sentCount + " of 200"),
  );
  assert.equal(tasks[0].description.length, 12000);
});

test("sprint filters completed tasks before its budget and canonicalizes stored titles", async (t) => {
  const tasks = [
    ...Array.from({ length: 100 }, (_, index) =>
      task(index, {
        description: "x".repeat(10000),
        column: { name: "Done", isDone: true },
      }),
    ),
    task(101, { title: "S".repeat(240) }),
  ];
  accessibleProject(t, tasks);
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const sent = JSON.parse(JSON.parse(options.body).input);
    assert.equal(sent.tasks.length, 1);
    assert.equal(sent.tasks[0].id, tasks[100].id);
    assert.ok(sent.tasks.every((item: any) => !item.completed));
    return completion({
      goal: "Ship",
      tasks: [
        { taskId: sent.tasks[0].id, title: "Invented title", reason: "Ready" },
      ],
      notes: [],
    });
  });
  const result = await service.sprintPlan(userId, { projectId, capacity: 1 });
  assert.equal(result.mode, "provider");
  assert.equal(result.result.tasks[0].title, tasks[100].title);
  assert.ok(sprintResult.safeParse(result.result).success);
});

for (const invalid of [
  "foreign",
  "completed",
  "omitted",
  "duplicate",
  "overcapacity",
] as const) {
  test(
    "sprint rejects " +
      invalid +
      " IDs and uses the complete local candidate snapshot",
    async (t) => {
      const tasks = Array.from({ length: 100 }, (_, index) =>
        task(index, {
          description: "x".repeat(10000),
          priority: index === 99 ? "URGENT" : "MEDIUM",
        }),
      );
      const done = task(200, { column: { name: "Done", isDone: true } });
      tasks.push(done);
      accessibleProject(t, tasks);
      const capacity = invalid === "overcapacity" ? 1 : 3;
      t.mock.method(globalThis, "fetch", async (_url, options) => {
        const sent = JSON.parse(JSON.parse(options.body).input);
        assert.ok(!sent.tasks.some((item: any) => item.id === tasks[99].id));
        const first = sent.tasks[0].id;
        const ids =
          invalid === "foreign"
            ? ["foreign-task-id"]
            : invalid === "completed"
              ? [done.id]
              : invalid === "omitted"
                ? [tasks[99].id]
                : invalid === "duplicate"
                  ? [first, first]
                  : [first, sent.tasks[1].id];
        return completion({
          goal: "Ship",
          tasks: ids.map((taskId) => ({
            taskId,
            title: "Untrusted title",
            reason: "Ready",
          })),
          notes: [],
        });
      });
      const result = await service.sprintPlan(userId, { projectId, capacity });
      assert.equal(result.mode, "local");
      assert.equal(result.fallbackReason, "invalid_response");
      assert.equal(result.provider, "groq");
      assert.equal(result.result.tasks[0].taskId, tasks[99].id);
      assert.equal(result.result.tasks[0].title, tasks[99].title);
      assert.ok(result.result.tasks.length <= capacity);
    },
  );
}

test("subtasks project only task fields after access validation", async (t) => {
  const source = {
    ...task(1),
    projectId,
    comments: ["private comment"],
    email: "private@example.test",
  };
  accessibleProject(t, [source]);
  t.mock.method(repository, "findTask", async () => source as any);
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const input = JSON.parse(options.body).input;
    assert.deepEqual(JSON.parse(input).tasks, taskContext([source]));
    assert.ok(!input.includes("private"));
    return completion({
      subtasks: [
        { title: "Verify", description: "Test the behavior", priority: "HIGH" },
      ],
    });
  });
  const result = await service.subtasks(userId, source.id);
  assert.equal(result.mode, "provider");
  assert.equal(result.result.subtasks.length, 1);
});

test("standup local mode uses a 201st-row sentinel to report only real truncation", async (t) => {
  process.env.AI_MODE = "local";
  override(t, prisma.workspaceMember, "findUnique", async () => ({
    userId,
    workspaceId,
    role: "MEMBER",
  }));
  let count = 200;
  t.mock.method(
    repository,
    "standupTasks",
    async (_db, workspace, user, admin) => {
      assert.equal(workspace, workspaceId);
      assert.equal(user, userId);
      assert.equal(admin, false);
      return Array.from({ length: count }, (_, index) => task(index)) as any;
    },
  );
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  let snapshot: any;
  const generate = service.generate.bind(service);
  t.mock.method(
    service,
    "generate",
    async (...args: Parameters<typeof service.generate>) => {
      snapshot = args[3];
      return generate(...args);
    },
  );
  await service.standup(userId, { workspaceId });
  assert.equal(snapshot.contextLimited, false);
  count = 201;
  await service.standup(userId, { workspaceId });
  assert.equal(snapshot.contextLimited, true);
  assert.equal(snapshot.tasks.length, 200);
  assert.equal(fetch.mock.callCount(), 0);
});
