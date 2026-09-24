import { Prisma } from "@prisma/client";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";
import { userSummary } from "../../shared/authorization";
import { CreateProject, CreateColumn } from "./projects.validation";

export const taskInclude = {
  assignee: { select: userSummary },
  _count: { select: { comments: true } },
  column: { select: { id: true, name: true, isDone: true } },
} as const;
export const projectInclude = {
  members: { include: { user: { select: userSummary } } },
  _count: { select: { tasks: true, members: true } },
} as const;
export const projectDetailInclude = {
  ...projectInclude,
  columns: {
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
    include: {
      tasks: {
        include: taskInclude,
        orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
} satisfies Prisma.ProjectInclude;

class ProjectsRepository {
  list(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
    manager: boolean,
  ) {
    return db.project.findMany({
      where: {
        workspaceId,
        ...(manager ? {} : { members: { some: { userId } } }),
      },
      include: projectInclude,
      orderBy: { updatedAt: "desc" },
    });
  }
  get(db: PrismaClientOrTransaction, id: string) {
    return db.project.findUnique({
      where: { id },
      include: projectDetailInclude,
    });
  }
  create(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId: string,
    data: CreateProject,
  ) {
    return db.project.create({
      data: {
        ...data,
        workspaceId,
        createdById: userId,
        members: { create: { userId } },
        columns: {
          create: [
            { name: "To do", position: 0 },
            { name: "In progress", position: 1 },
            { name: "Done", position: 2, isDone: true },
          ],
        },
      },
      include: projectDetailInclude,
    });
  }
  update(
    db: PrismaClientOrTransaction,
    id: string,
    data: Prisma.ProjectUpdateInput,
  ) {
    return db.project.update({
      where: { id },
      data,
      include: projectDetailInclude,
    });
  }
  delete(db: PrismaClientOrTransaction, id: string) {
    return db.project.delete({ where: { id } });
  }
  members(db: PrismaClientOrTransaction, projectId: string) {
    return db.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSummary } },
      orderBy: { createdAt: "asc" },
    });
  }
  addMember(db: PrismaClientOrTransaction, projectId: string, userId: string) {
    return db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
      include: { user: { select: userSummary } },
    });
  }
  async removeMember(
    db: PrismaClientOrTransaction,
    projectId: string,
    userId: string,
  ) {
    await db.task.updateMany({
      where: { projectId, assigneeId: userId },
      data: { assigneeId: null },
    });
    return db.projectMember.deleteMany({ where: { projectId, userId } });
  }
  column(db: PrismaClientOrTransaction, id: string) {
    return db.column.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
  }
  columns(db: PrismaClientOrTransaction, projectId: string) {
    return db.column.findMany({
      where: { projectId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
  }
  createColumn(
    db: PrismaClientOrTransaction,
    projectId: string,
    position: number,
    data: CreateColumn,
  ) {
    return db.column.create({
      data: { ...data, projectId, position },
      include: { tasks: { include: taskInclude } },
    });
  }
  updateColumn(
    db: PrismaClientOrTransaction,
    id: string,
    data: Prisma.ColumnUpdateInput,
  ) {
    return db.column.update({ where: { id }, data });
  }
  deleteColumn(db: PrismaClientOrTransaction, id: string) {
    return db.column.delete({ where: { id } });
  }
  lockWorkspace(db: PrismaClientOrTransaction, id: string) {
    return db.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${id} FOR NO KEY UPDATE`;
  }
  lockProject(db: PrismaClientOrTransaction, id: string) {
    return db.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR NO KEY UPDATE`;
  }
}
export default new ProjectsRepository();
