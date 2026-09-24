import { HTTP_STATUS } from "../../shared/constants/http-status";
import { prisma } from "../../lib/prisma";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";
import { ApiError } from "../../shared/errors/ApiError";
import {
  isWorkspaceManager,
  recordActivity,
  requireProjectAccess,
  requireWorkspaceMember,
} from "../../shared/authorization";
import repository from "./tasks.repository";
import { CreateTask, MoveTask, UpdateTask } from "./tasks.validation";

export function reorderTaskIds(
  items: Array<{ id: string }>,
  taskId: string,
  position: number,
) {
  const ids = items.filter((item) => item.id !== taskId).map((item) => item.id);
  ids.splice(Math.min(position, ids.length), 0, taskId);
  return ids;
}

class TasksService {
  private async accessibleTask(
    db: PrismaClientOrTransaction,
    id: string,
    userId: string,
  ) {
    const task = await repository.get(db, id);
    if (!task) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
    const access = await requireProjectAccess(db, task.projectId, userId);
    return { task, ...access };
  }
  private async validateAssignee(
    db: PrismaClientOrTransaction,
    projectId: string,
    workspaceId: string,
    assigneeId?: string | null,
  ) {
    if (!assigneeId) return;
    const member = await requireWorkspaceMember(db, workspaceId, assigneeId);
    if (
      !isWorkspaceManager(member.role) &&
      !(await repository.member(db, projectId, assigneeId))
    )
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        "Assignee must have access to this project",
      );
  }
  async get(userId: string, id: string) {
    return { task: (await this.accessibleTask(prisma, id, userId)).task };
  }
  async list(userId: string, projectId: string, limit: number, offset: number) {
    await requireProjectAccess(prisma, projectId, userId);
    return { tasks: await repository.list(prisma, projectId, limit, offset) };
  }
  async create(userId: string, projectId: string, data: CreateTask) {
    await requireProjectAccess(prisma, projectId, userId);
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, projectId);
      const { project } = await requireProjectAccess(tx, projectId, userId);
      const column = await repository.column(tx, data.columnId);
      if (!column || column.projectId !== projectId)
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "Column must belong to this project",
        );
      await this.validateAssignee(
        tx,
        projectId,
        project.workspaceId,
        data.assigneeId,
      );
      const position = (await repository.columnTasks(tx, data.columnId)).length;
      const task = await repository.create(tx, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        projectId,
        createdById: userId,
        position,
      });
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId,
        actorId: userId,
        action: "task.created",
        description: `Created task ${task.title}`,
      });
      return { task };
    });
  }
  async update(userId: string, id: string, data: UpdateTask) {
    const { task, project } = await this.accessibleTask(prisma, id, userId);
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, project.id);
      await this.accessibleTask(tx, id, userId);
      await this.validateAssignee(
        tx,
        project.id,
        project.workspaceId,
        data.assigneeId,
      );
      const updated = await repository.update(tx, id, {
        ...data,
        ...(data.dueDate !== undefined
          ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
          : {}),
      });
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "task.updated",
        description: `Updated task ${task.title}`,
      });
      return { task: updated };
    });
  }
  async move(userId: string, id: string, data: MoveTask) {
    const { task: initialTask, project } = await this.accessibleTask(
      prisma,
      id,
      userId,
    );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, initialTask.projectId);
      const { task } = await this.accessibleTask(tx, id, userId);
      const destination = await repository.column(tx, data.columnId);
      if (!destination || destination.projectId !== task.projectId)
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "Destination column must belong to the task's project",
        );
      const targetTasks = await repository.columnTasks(tx, destination.id);
      const targetOrder = reorderTaskIds(targetTasks, id, data.position);
      const targetById = new Map(targetTasks.map((item) => [item.id, item]));
      if (task.columnId !== destination.id) {
        const source = (await repository.columnTasks(tx, task.columnId)).filter(
          (item) => item.id !== id,
        );
        for (const [position, item] of source.entries()) {
          if (item.position !== position)
            await repository.reposition(tx, item.id, position, item.updatedAt);
        }
      }
      for (const [position, taskId] of targetOrder.entries()) {
        if (taskId === id) {
          if (task.columnId === destination.id) {
            await repository.reposition(tx, taskId, position, task.updatedAt);
          } else {
            await repository.update(tx, taskId, {
              position,
              columnId: destination.id,
            });
          }
        } else {
          const sibling = targetById.get(taskId)!;
          if (sibling.position !== position)
            await repository.reposition(
              tx,
              taskId,
              position,
              sibling.updatedAt,
            );
        }
      }
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "task.moved",
        description: `Moved ${task.title} to ${destination.name}`,
      });
      return { task: await repository.get(tx, id) };
    });
  }
  async delete(userId: string, id: string) {
    const { task: initialTask, project } = await this.accessibleTask(
      prisma,
      id,
      userId,
    );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, initialTask.projectId);
      const { task } = await this.accessibleTask(tx, id, userId);
      await repository.delete(tx, id);
      const remaining = await repository.columnTasks(tx, task.columnId);
      for (const [position, item] of remaining.entries()) {
        if (item.position !== position)
          await repository.reposition(tx, item.id, position, item.updatedAt);
      }
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "task.deleted",
        description: `Deleted task ${task.title}`,
      });
      return {};
    });
  }
  async comments(userId: string, id: string, limit: number, offset: number) {
    await this.accessibleTask(prisma, id, userId);
    return { comments: await repository.comments(prisma, id, limit, offset) };
  }
  async addComment(userId: string, id: string, content: string) {
    const { task, project } = await this.accessibleTask(prisma, id, userId);
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, project.id);
      await this.accessibleTask(tx, id, userId);
      const comment = await repository.createComment(tx, id, userId, content);
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "comment.created",
        description: `Commented on ${task.title}`,
      });
      return { comment };
    });
  }
  async deleteComment(userId: string, id: string) {
    const comment = await repository.comment(prisma, id);
    if (!comment)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Comment not found");
    const { project, workspaceMember } = await requireProjectAccess(
      prisma,
      comment.task.projectId,
      userId,
    );
    if (
      comment.authorId !== userId &&
      !isWorkspaceManager(workspaceMember.role)
    )
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Only the author or a workspace administrator can delete this comment",
      );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, project.id);
      const access = await requireProjectAccess(tx, project.id, userId);
      if (
        comment.authorId !== userId &&
        !isWorkspaceManager(access.workspaceMember.role)
      )
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "Only the author or a workspace administrator can delete this comment",
        );
      await repository.deleteComment(tx, id);
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "comment.deleted",
        description: `Deleted a comment on ${comment.task.title}`,
      });
      return {};
    });
  }
}
export default new TasksService();
