import { HTTP_STATUS } from "./constants/http-status";
import { PrismaClientOrTransaction } from "../lib/prisma.types";
import { ApiError } from "./errors/ApiError";

export const userSummary = { id: true, name: true, avatar: true } as const;
export const isWorkspaceManager = (role: string) =>
  role === "OWNER" || role === "ADMIN";

export async function requireWorkspaceMember(
  db: PrismaClientOrTransaction,
  workspaceId: string,
  userId: string,
) {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Workspace not found");
  return member;
}

export async function requireWorkspaceManager(
  db: PrismaClientOrTransaction,
  workspaceId: string,
  userId: string,
) {
  const member = await requireWorkspaceMember(db, workspaceId, userId);
  if (!isWorkspaceManager(member.role))
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Workspace administrator access required",
    );
  return member;
}

export async function requireProjectAccess(
  db: PrismaClientOrTransaction,
  projectId: string,
  userId: string,
  manage = false,
) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
  const workspaceMember = await requireWorkspaceMember(
    db,
    project.workspaceId,
    userId,
  );
  const isManager = isWorkspaceManager(workspaceMember.role);
  const membership = isManager
    ? true
    : await db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });
  if (!membership)
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
  if (manage && !isManager && project.createdById !== userId)
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Project manager access required",
    );
  return { project, workspaceMember };
}

export async function recordActivity(
  db: PrismaClientOrTransaction,
  data: {
    workspaceId: string;
    projectId?: string;
    actorId: string;
    action: string;
    description: string;
  },
) {
  return db.activity.create({ data });
}
