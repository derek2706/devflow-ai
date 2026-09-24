import { Prisma, WorkspaceRole } from "@prisma/client";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";
import { userSummary } from "../../shared/authorization";

const memberInclude = { user: { select: userSummary } } as const;
const workspaceInclude = {
  _count: { select: { members: true, projects: true } },
} as const;

class WorkspacesRepository {
  list(db: PrismaClientOrTransaction, userId: string) {
    return db.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        ...workspaceInclude,
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  find(db: PrismaClientOrTransaction, id: string) {
    return db.workspace.findUnique({
      where: { id },
      include: {
        ...workspaceInclude,
        members: { include: memberInclude, orderBy: { createdAt: "asc" } },
      },
    });
  }
  create(
    db: PrismaClientOrTransaction,
    userId: string,
    data: { name: string; description: string },
  ) {
    return db.workspace.create({
      data: { ...data, members: { create: { userId, role: "OWNER" } } },
      include: workspaceInclude,
    });
  }
  update(
    db: PrismaClientOrTransaction,
    id: string,
    data: Prisma.WorkspaceUpdateInput,
  ) {
    return db.workspace.update({
      where: { id },
      data,
      include: workspaceInclude,
    });
  }
  delete(db: PrismaClientOrTransaction, id: string) {
    return db.workspace.delete({ where: { id } });
  }
  members(db: PrismaClientOrTransaction, workspaceId: string) {
    return db.workspaceMember.findMany({
      where: { workspaceId },
      include: memberInclude,
      orderBy: { createdAt: "asc" },
    });
  }
  member(db: PrismaClientOrTransaction, workspaceId: string, userId: string) {
    return db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: memberInclude,
    });
  }
  updateMember(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ) {
    return db.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
      include: memberInclude,
    });
  }
  async removeMember(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
  ) {
    await db.task.updateMany({
      where: { project: { workspaceId }, assigneeId: userId },
      data: { assigneeId: null },
    });
    await db.projectMember.deleteMany({
      where: { userId, project: { workspaceId } },
    });
    return db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }
  clearInaccessibleAssignments(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
  ) {
    return db.task.updateMany({
      where: {
        assigneeId: userId,
        project: { workspaceId, members: { none: { userId } } },
      },
      data: { assigneeId: null },
    });
  }
  async revokeInvitations(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
    includeRecipient: boolean,
  ) {
    const identities = includeRecipient
      ? await db.authentication.findMany({
          where: { userId, provider: "EMAIL" },
          select: { identifier: true },
        })
      : [];
    return db.workspaceInvitation.deleteMany({
      where: {
        workspaceId,
        acceptedAt: null,
        OR: [
          { invitedById: userId },
          ...(identities.length
            ? [
                {
                  email: {
                    in: identities.map((identity) => identity.identifier),
                  },
                },
              ]
            : []),
        ],
      },
    });
  }
  lockWorkspace(db: PrismaClientOrTransaction, id: string) {
    return db.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${id} FOR NO KEY UPDATE`;
  }
  lockProjects(db: PrismaClientOrTransaction, workspaceId: string) {
    return db.$queryRaw`SELECT id FROM "Project" WHERE "workspaceId" = ${workspaceId} ORDER BY id FOR NO KEY UPDATE`;
  }
  createInvitation(
    db: PrismaClientOrTransaction,
    data: Prisma.WorkspaceInvitationUncheckedCreateInput,
  ) {
    return db.workspaceInvitation.create({ data });
  }
  invitation(db: PrismaClientOrTransaction, tokenHash: string) {
    return db.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: { workspace: true },
    });
  }
  emailIdentity(
    db: PrismaClientOrTransaction,
    userId: string,
    identifier: string,
  ) {
    return db.authentication.findFirst({
      where: { userId, provider: "EMAIL", identifier },
    });
  }
  acceptInvitation(db: PrismaClientOrTransaction, id: string) {
    return db.workspaceInvitation.updateMany({
      where: { id, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
  }
  join(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ) {
    return db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, role },
      update: {},
    });
  }
}
export default new WorkspacesRepository();
