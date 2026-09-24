import { prisma } from "../../lib/prisma";
import { requireWorkspaceMember } from "../../shared/authorization";
import { workspaceSummary } from "../workspaces/workspaces.service";
import repository from "./dashboard.repository";

class DashboardService {
  async get(userId: string, workspaceId?: string) {
    if (workspaceId) await requireWorkspaceMember(prisma, workspaceId, userId);
    const [
      workspaces,
      projects,
      recentTasks,
      recentActivity,
      projectCount,
      tasks,
      completedTasks,
      overdueTasks,
    ] = await Promise.all([
      repository.workspaces(prisma, userId, workspaceId),
      repository.projects(prisma, userId, workspaceId),
      repository.recentTasks(prisma, userId, workspaceId),
      repository.recentActivity(prisma, userId, workspaceId),
      repository.countProjects(prisma, userId, workspaceId),
      repository.countTasks(prisma, userId, workspaceId),
      repository.countTasks(prisma, userId, workspaceId, "completed"),
      repository.countTasks(prisma, userId, workspaceId, "overdue"),
    ]);
    const visibleWorkspaces = workspaces.flatMap((workspace) =>
      workspace.members[0]
        ? [workspaceSummary(workspace, workspace.members[0].role)]
        : [],
    );
    return {
      workspaces: visibleWorkspaces,
      projects,
      recentTasks,
      recentActivity,
      stats: {
        workspaces: visibleWorkspaces.length,
        projects: projectCount,
        tasks,
        completedTasks,
        overdueTasks,
      },
    };
  }
}
export default new DashboardService();
