import { HTTP_STATUS } from "../../shared/constants/http-status";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../shared/errors/ApiError";
import {
  isWorkspaceManager,
  recordActivity,
  requireWorkspaceManager,
  requireWorkspaceMember,
} from "../../shared/authorization";
import repository from "./workspaces.repository";
import {
  CreateWorkspace,
  InviteMember,
  UpdateWorkspace,
} from "./workspaces.validation";

export const workspaceSummary = <
  T extends { _count: { members: number; projects: number } },
>(
  workspace: T,
  role: string,
) => ({
  ...workspace,
  role,
  memberCount: workspace._count.members,
  projectCount: workspace._count.projects,
});

class WorkspacesService {
  async list(userId: string) {
    const workspaces = await repository.list(prisma, userId);
    return {
      workspaces: workspaces.flatMap((workspace) =>
        workspace.members[0]
          ? [workspaceSummary(workspace, workspace.members[0].role)]
          : [],
      ),
    };
  }
  async get(userId: string, id: string) {
    const member = await requireWorkspaceMember(prisma, id, userId);
    const workspace = await repository.find(prisma, id);
    if (!workspace)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Workspace not found");
    return { workspace: workspaceSummary(workspace, member.role) };
  }
  async create(userId: string, data: CreateWorkspace) {
    const workspace = await prisma.$transaction(async (tx) => {
      const result = await repository.create(tx, userId, data);
      await recordActivity(tx, {
        workspaceId: result.id,
        actorId: userId,
        action: "workspace.created",
        description: `Created workspace ${result.name}`,
      });
      return result;
    });
    return { workspace: workspaceSummary(workspace, "OWNER") };
  }
  async update(userId: string, id: string, data: UpdateWorkspace) {
    const member = await requireWorkspaceManager(prisma, id, userId);
    const workspace = await prisma.$transaction(async (tx) => {
      await repository.lockWorkspace(tx, id);
      await requireWorkspaceManager(tx, id, userId);
      const result = await repository.update(tx, id, data);
      await recordActivity(tx, {
        workspaceId: id,
        actorId: userId,
        action: "workspace.updated",
        description: `Updated workspace ${result.name}`,
      });
      return result;
    });
    return { workspace: workspaceSummary(workspace, member.role) };
  }
  async delete(userId: string, id: string) {
    const member = await requireWorkspaceMember(prisma, id, userId);
    if (member.role !== "OWNER")
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Only the workspace owner can delete the workspace",
      );
    return prisma.$transaction(async (tx) => {
      await repository.lockWorkspace(tx, id);
      await repository.lockProjects(tx, id);
      const current = await requireWorkspaceMember(tx, id, userId);
      if (current.role !== "OWNER")
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "Only the workspace owner can delete the workspace",
        );
      await repository.delete(tx, id);
      return {};
    });
  }
  async members(userId: string, id: string) {
    await requireWorkspaceMember(prisma, id, userId);
    return { members: await repository.members(prisma, id) };
  }
  async updateMember(
    userId: string,
    id: string,
    targetId: string,
    role: "ADMIN" | "MEMBER",
  ) {
    await requireWorkspaceManager(prisma, id, userId);
    const member = await repository.member(prisma, id, targetId);
    if (!member) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Member not found");
    if (member.role === "OWNER")
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "The workspace owner cannot be demoted",
      );
    return prisma.$transaction(async (tx) => {
      await repository.lockWorkspace(tx, id);
      await repository.lockProjects(tx, id);
      await requireWorkspaceManager(tx, id, userId);
      const current = await repository.member(tx, id, targetId);
      if (!current)
        throw new ApiError(HTTP_STATUS.NOT_FOUND, "Member not found");
      if (current.role === "OWNER")
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "The workspace owner cannot be demoted",
        );
      const updated = await repository.updateMember(tx, id, targetId, role);
      if (role === "MEMBER") {
        await repository.revokeInvitations(tx, id, targetId, false);
        await repository.clearInaccessibleAssignments(tx, id, targetId);
      }
      await recordActivity(tx, {
        workspaceId: id,
        actorId: userId,
        action: "member.updated",
        description: `Changed ${member.user.name}'s role to ${role.toLowerCase()}`,
      });
      return { member: updated };
    });
  }
  async removeMember(userId: string, id: string, targetId: string) {
    await requireWorkspaceManager(prisma, id, userId);
    const member = await repository.member(prisma, id, targetId);
    if (!member) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Member not found");
    if (member.role === "OWNER")
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "The workspace owner cannot be removed",
      );
    return prisma.$transaction(async (tx) => {
      await repository.lockWorkspace(tx, id);
      await repository.lockProjects(tx, id);
      await requireWorkspaceManager(tx, id, userId);
      const current = await repository.member(tx, id, targetId);
      if (!current)
        throw new ApiError(HTTP_STATUS.NOT_FOUND, "Member not found");
      if (current.role === "OWNER")
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "The workspace owner cannot be removed",
        );
      await repository.revokeInvitations(tx, id, targetId, true);
      await repository.removeMember(tx, id, targetId);
      await recordActivity(tx, {
        workspaceId: id,
        actorId: userId,
        action: "member.removed",
        description: `Removed ${member.user.name} from the workspace`,
      });
      return {};
    });
  }
  async invite(userId: string, id: string, data: InviteMember) {
    await requireWorkspaceManager(prisma, id, userId);
    const token = randomBytes(32).toString("hex");
    const invitation = await prisma.$transaction(async (tx) => {
      await repository.lockWorkspace(tx, id);
      await requireWorkspaceManager(tx, id, userId);
      const result = await repository.createInvitation(tx, {
        workspaceId: id,
        email: data.email,
        role: data.role,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        invitedById: userId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      await recordActivity(tx, {
        workspaceId: id,
        actorId: userId,
        action: "member.invited",
        description: "Invited a workspace member",
      });
      return {
        id: result.id,
        email: result.email,
        role: result.role,
        expiresAt: result.expiresAt,
      };
    });
    return { invitation, inviteUrl: `/invite?token=${token}` };
  }
  async accept(userId: string, token: string) {
    return prisma.$transaction(async (tx) => {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const initial = await repository.invitation(tx, tokenHash);
      if (!initial)
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "Invitation is invalid or expired",
        );
      await repository.lockWorkspace(tx, initial.workspaceId);
      const invitation = await repository.invitation(tx, tokenHash);
      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt <= new Date()
      )
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "Invitation is invalid or expired",
        );
      const inviter = await repository.member(
        tx,
        invitation.workspaceId,
        invitation.invitedById,
      );
      if (!inviter || !isWorkspaceManager(inviter.role))
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "Invitation is no longer valid",
        );
      if (!(await repository.emailIdentity(tx, userId, invitation.email)))
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "Sign in with the email address this invitation was sent to",
        );
      if ((await repository.acceptInvitation(tx, invitation.id)).count !== 1)
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          "Invitation has already been accepted",
        );
      await repository.join(
        tx,
        invitation.workspaceId,
        userId,
        invitation.role,
      );
      await recordActivity(tx, {
        workspaceId: invitation.workspaceId,
        actorId: userId,
        action: "member.joined",
        description: "Joined the workspace",
      });
      return { workspace: invitation.workspace };
    });
  }
}
export default new WorkspacesService();
