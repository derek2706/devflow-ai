import { Prisma } from "@prisma/client";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";
import { userSummary } from "../../shared/authorization";
import { taskInclude } from "../projects/projects.repository";

class TasksRepository {
  get(db: PrismaClientOrTransaction, id: string) {
    return db.task.findUnique({
      where: { id },
      include: {
        ...taskInclude,
        createdBy: { select: userSummary },
        project: { select: { id: true, name: true, workspaceId: true } },
      },
    });
  }
  list(
    db: PrismaClientOrTransaction,
    projectId: string,
    limit: number,
    offset: number,
  ) {
    return db.task.findMany({
      where: { projectId },
      include: taskInclude,
      orderBy: [{ columnId: "asc" }, { position: "asc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    });
  }
  column(db: PrismaClientOrTransaction, id: string) {
    return db.column.findUnique({ where: { id } });
  }
  member(db: PrismaClientOrTransaction, projectId: string, userId: string) {
    return db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }
  columnTasks(db: PrismaClientOrTransaction, columnId: string) {
    return db.task.findMany({
      where: { columnId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true, updatedAt: true },
    });
  }
  create(db: PrismaClientOrTransaction, data: Prisma.TaskUncheckedCreateInput) {
    return db.task.create({ data, include: taskInclude });
  }
  update(
    db: PrismaClientOrTransaction,
    id: string,
    data: Prisma.TaskUncheckedUpdateInput,
  ) {
    return db.task.update({ where: { id }, data, include: taskInclude });
  }
  reposition(
    db: PrismaClientOrTransaction,
    id: string,
    position: number,
    updatedAt: Date,
  ) {
    return db.task.update({ where: { id }, data: { position, updatedAt } });
  }
  delete(db: PrismaClientOrTransaction, id: string) {
    return db.task.delete({ where: { id } });
  }
  comments(
    db: PrismaClientOrTransaction,
    taskId: string,
    limit: number,
    offset: number,
  ) {
    return db.comment.findMany({
      where: { taskId },
      include: { author: { select: userSummary } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
    });
  }
  createComment(
    db: PrismaClientOrTransaction,
    taskId: string,
    authorId: string,
    content: string,
  ) {
    return db.comment.create({
      data: { taskId, authorId, content },
      include: { author: { select: userSummary } },
    });
  }
  comment(db: PrismaClientOrTransaction, id: string) {
    return db.comment.findUnique({ where: { id }, include: { task: true } });
  }
  deleteComment(db: PrismaClientOrTransaction, id: string) {
    return db.comment.delete({ where: { id } });
  }
  lockProject(db: PrismaClientOrTransaction, id: string) {
    return db.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR NO KEY UPDATE`;
  }
}
export default new TasksRepository();
