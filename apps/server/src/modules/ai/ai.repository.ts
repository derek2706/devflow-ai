import type { PrismaClientOrTransaction } from "../../lib/prisma.types";

class AiRepository {
  findTask(db: PrismaClientOrTransaction, id: string) {
    return db.task.findUnique({ where: { id }, include: { column: true } });
  }

  projectContext(db: PrismaClientOrTransaction, projectId: string) {
    return db.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        description: true,
        _count: { select: { tasks: true } },
        tasks: {
          orderBy: { updatedAt: "desc" },
          take: 200,
          include: { column: true },
        },
      },
    });
  }

  standupTasks(
    db: PrismaClientOrTransaction,
    workspaceId: string,
    userId: string,
    isAdmin: boolean,
  ) {
    return db.task.findMany({
      where: {
        assigneeId: userId,
        project: {
          workspaceId,
          ...(isAdmin ? {} : { members: { some: { userId } } }),
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { column: true },
    });
  }
}

export default new AiRepository();
