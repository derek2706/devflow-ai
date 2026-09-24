import { HTTP_STATUS } from "../../shared/constants/http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../shared/errors/ApiError";
import {
  isWorkspaceManager,
  recordActivity,
  requireProjectAccess,
  requireWorkspaceMember,
} from "../../shared/authorization";
import repository from "./projects.repository";
import {
  CreateColumn,
  CreateProject,
  UpdateColumn,
  UpdateProject,
} from "./projects.validation";

class ProjectsService {
  async list(userId: string, workspaceId: string) {
    const member = await requireWorkspaceMember(prisma, workspaceId, userId);
    return {
      projects: await repository.list(
        prisma,
        workspaceId,
        userId,
        isWorkspaceManager(member.role),
      ),
    };
  }
  async get(userId: string, id: string) {
    await requireProjectAccess(prisma, id, userId);
    const project = await repository.get(prisma, id);
    if (!project)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
    return { project };
  }
  async create(userId: string, workspaceId: string, data: CreateProject) {
    await requireWorkspaceMember(prisma, workspaceId, userId);
    return prisma.$transaction(async (tx) => {
      await repository.lockWorkspace(tx, workspaceId);
      await requireWorkspaceMember(tx, workspaceId, userId);
      const project = await repository.create(tx, userId, workspaceId, data);
      await recordActivity(tx, {
        workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "project.created",
        description: `Created project ${project.name}`,
      });
      return { project };
    });
  }
  async update(userId: string, id: string, data: UpdateProject) {
    const { project } = await requireProjectAccess(prisma, id, userId, true);
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, id);
      await requireProjectAccess(tx, id, userId, true);
      const updated = await repository.update(tx, id, data);
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: id,
        actorId: userId,
        action: "project.updated",
        description: `Updated project ${updated.name}`,
      });
      return { project: updated };
    });
  }
  async delete(userId: string, id: string) {
    const { project } = await requireProjectAccess(prisma, id, userId, true);
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, id);
      await requireProjectAccess(tx, id, userId, true);
      await repository.delete(tx, id);
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        actorId: userId,
        action: "project.deleted",
        description: "Deleted a project",
      });
      return {};
    });
  }
  async members(userId: string, id: string) {
    await requireProjectAccess(prisma, id, userId);
    return { members: await repository.members(prisma, id) };
  }
  async addMember(userId: string, id: string, targetId: string) {
    const { project } = await requireProjectAccess(prisma, id, userId, true);
    await requireWorkspaceMember(prisma, project.workspaceId, targetId);
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, id);
      await requireProjectAccess(tx, id, userId, true);
      await requireWorkspaceMember(tx, project.workspaceId, targetId);
      const member = await repository.addMember(tx, id, targetId);
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: id,
        actorId: userId,
        action: "project.member_added",
        description: `Added ${member.user.name} to ${project.name}`,
      });
      return { member };
    });
  }
  async removeMember(userId: string, id: string, targetId: string) {
    const { project } = await requireProjectAccess(prisma, id, userId, true);
    if (project.createdById === targetId)
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        "The project creator cannot be removed from the project",
      );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, id);
      await requireProjectAccess(tx, id, userId, true);
      const result = await repository.removeMember(tx, id, targetId);
      if (!result.count)
        throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project member not found");
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: id,
        actorId: userId,
        action: "project.member_removed",
        description: `Removed a member from ${project.name}`,
      });
      return {};
    });
  }
  async createColumn(userId: string, projectId: string, data: CreateColumn) {
    const { project } = await requireProjectAccess(
      prisma,
      projectId,
      userId,
      true,
    );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, projectId);
      await requireProjectAccess(tx, projectId, userId, true);
      const columns = await repository.columns(tx, projectId);
      if (columns.length >= 100)
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "A board can have at most 100 columns",
        );
      const column = await repository.createColumn(
        tx,
        projectId,
        columns.length,
        data,
      );
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId,
        actorId: userId,
        action: "column.created",
        description: `Added column ${column.name}`,
      });
      return { column };
    });
  }
  async updateColumn(userId: string, id: string, data: UpdateColumn) {
    const column = await repository.column(prisma, id);
    if (!column) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Column not found");
    const { project } = await requireProjectAccess(
      prisma,
      column.projectId,
      userId,
      true,
    );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, project.id);
      await requireProjectAccess(tx, project.id, userId, true);
      const columns = await repository.columns(tx, project.id);
      if (data.position !== undefined) {
        const reordered = columns.filter((item) => item.id !== id);
        reordered.splice(Math.min(data.position, reordered.length), 0, column);
        for (const [position, item] of reordered.entries())
          await repository.updateColumn(tx, item.id, { position });
      }
      const updated = await repository.updateColumn(tx, id, {
        name: data.name,
        isDone: data.isDone,
      });
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "column.updated",
        description: `Updated column ${updated.name}`,
      });
      return { column: updated };
    });
  }
  async deleteColumn(userId: string, id: string) {
    const column = await repository.column(prisma, id);
    if (!column) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Column not found");
    const { project } = await requireProjectAccess(
      prisma,
      column.projectId,
      userId,
      true,
    );
    return prisma.$transaction(async (tx) => {
      await repository.lockProject(tx, project.id);
      await requireProjectAccess(tx, project.id, userId, true);
      const current = await repository.column(tx, id);
      if (!current)
        throw new ApiError(HTTP_STATUS.NOT_FOUND, "Column not found");
      if (current._count.tasks)
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          "Move or delete the tasks before deleting this column",
        );
      const columns = await repository.columns(tx, project.id);
      if (columns.length <= 1)
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          "A project must have at least one column",
        );
      await repository.deleteColumn(tx, id);
      for (const [position, item] of columns
        .filter((item) => item.id !== id)
        .entries())
        await repository.updateColumn(tx, item.id, { position });
      await recordActivity(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: userId,
        action: "column.deleted",
        description: `Deleted column ${column.name}`,
      });
      return {};
    });
  }
}
export default new ProjectsService();
