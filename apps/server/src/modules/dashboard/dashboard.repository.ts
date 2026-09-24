import { Prisma } from "@prisma/client";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";
import { userSummary } from "../../shared/authorization";
import { projectInclude, taskInclude } from "../projects/projects.repository";

export function visibleProjects(
  userId: string,
  workspaceId?: string,
): Prisma.ProjectWhereInput {
  return {
    ...(workspaceId ? { workspaceId } : {}),
    workspace: { members: { some: { userId } } },
    OR: [
      {
        workspace: {
          members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } },
        },
      },
      { members: { some: { userId } } },
    ],
  };
}

class DashboardRepository {
  workspaces(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId?: string,
  ) {
    return db.workspace.findMany({
      where: {
        ...(workspaceId ? { id: workspaceId } : {}),
        members: { some: { userId } },
      },
      include: {
        _count: { select: { members: true, projects: true } },
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  projects(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId?: string,
  ) {
    return db.project.findMany({
      where: visibleProjects(userId, workspaceId),
      include: projectInclude,
      orderBy: { updatedAt: "desc" },
      take: 12,
    });
  }
  recentTasks(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId?: string,
  ) {
    return db.task.findMany({
      where: { project: visibleProjects(userId, workspaceId) },
      include: {
        ...taskInclude,
        project: {
          select: { id: true, name: true, color: true, workspaceId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    });
  }
  recentActivity(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId?: string,
  ) {
    return db.activity.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        workspace: { members: { some: { userId } } },
        OR: [
          { projectId: null },
          { project: visibleProjects(userId, workspaceId) },
        ],
      },
      include: {
        actor: { select: userSummary },
        project: { select: { id: true, name: true } },
        workspace: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
  countProjects(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId?: string,
  ) {
    return db.project.count({ where: visibleProjects(userId, workspaceId) });
  }
  countTasks(
    db: PrismaClientOrTransaction,
    userId: string,
    workspaceId?: string,
    filter?: "completed" | "overdue",
  ) {
    return db.task.count({
      where: {
        project: visibleProjects(userId, workspaceId),
        ...(filter === "completed" ? { column: { isDone: true } } : {}),
        ...(filter === "overdue"
          ? { dueDate: { lt: new Date() }, column: { isDone: false } }
          : {}),
      },
    });
  }
}
export default new DashboardRepository();
