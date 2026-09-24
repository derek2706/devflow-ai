import type { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getEnv } from "../../config/env";
import {
  requireProjectAccess,
  requireWorkspaceMember,
} from "../../shared/authorization";
import { ApiError } from "../../shared/errors/ApiError";
import { HTTP_STATUS } from "../../shared/constants/http-status";
import repository from "./ai.repository";
import {
  planSubtasks,
  summarizeProject,
  planSprint,
  generateStandup,
  type PlanningTask,
} from "./ai.planner";
import { generateWithProvider } from "./ai.provider";
import {
  subtasksResult,
  summaryResult,
  sprintResult,
  standupResult,
  type sprintSchema,
  type standupSchema,
} from "./ai.validation";

// Provider context deliberately excludes emails, comments, credentials, and member profiles.
function taskContext(tasks: PlanningTask[]) {
  return tasks.map(
    ({ id, title, description, priority, dueDate, updatedAt, column }) => ({
      id,
      title,
      description,
      priority,
      dueDate,
      updatedAt,
      status: column.name,
      completed: column.isDone,
    }),
  );
}

class AiService {
  async generate<T>(
    schema: z.ZodType<T>,
    name: string,
    instruction: string,
    context: unknown,
    local: () => T,
  ) {
    const mode = getEnv().AI_MODE;
    const result =
      mode === "provider"
        ? await generateWithProvider(schema, name, instruction, context)
        : schema.parse(local());
    return { mode, result };
  }

  async subtasks(userId: string, taskId: string) {
    const task = await repository.findTask(prisma, taskId);
    if (!task) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
    await requireProjectAccess(prisma, task.projectId, userId);
    return this.generate(
      subtasksResult,
      "subtasks",
      "Break the task into 3–7 concrete, independently verifiable subtasks.",
      taskContext([task]),
      () => planSubtasks(task),
    );
  }

  async projectSummary(userId: string, projectId: string) {
    await requireProjectAccess(prisma, projectId, userId);
    const project = await repository.projectContext(prisma, projectId);
    if (!project)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
    const result = await this.generate(
      summaryResult,
      "project_summary",
      "Summarize the supplied project snapshot, its progress, highlights, and concrete risks. The snapshot contains at most 200 recently updated tasks.",
      {
        name: project.name,
        description: project.description,
        totalTasks: project._count.tasks,
        tasks: taskContext(project.tasks),
      },
      () => summarizeProject(project.name, project.tasks),
    );
    if (project._count.tasks > project.tasks.length) {
      result.result.summary = `Snapshot of the latest ${project.tasks.length} of ${project._count.tasks} tasks. ${result.result.summary}`;
    }
    return result;
  }

  async sprintPlan(userId: string, data: z.infer<typeof sprintSchema>) {
    await requireProjectAccess(prisma, data.projectId, userId);
    const project = await repository.projectContext(prisma, data.projectId);
    if (!project)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
    const result = await this.generate(
      sprintResult,
      "sprint_plan",
      `Propose a sprint using at most ${data.capacity} unfinished tasks from the provided snapshot. Use only supplied task IDs.`,
      {
        name: project.name,
        goal: data.goal,
        capacity: data.capacity,
        tasks: taskContext(project.tasks),
      },
      () => planSprint(project.tasks, data.goal, data.capacity),
    );
    const allowed = new Set(
      project.tasks
        .filter((task) => !task.column.isDone)
        .map((task) => task.id),
    );
    const selected = result.result.tasks.map((task) => task.taskId);
    if (
      selected.length > data.capacity ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !allowed.has(id))
    ) {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        "The AI provider suggested tasks outside this project's available backlog. Please try again.",
      );
    }
    if (project._count.tasks > project.tasks.length)
      result.result.notes.push(
        `Candidates are limited to the latest ${project.tasks.length} of ${project._count.tasks} tasks.`,
      );
    return result;
  }

  async standup(userId: string, data: z.infer<typeof standupSchema>) {
    const member = await requireWorkspaceMember(
      prisma,
      data.workspaceId,
      userId,
    );
    const tasks = await repository.standupTasks(
      prisma,
      data.workspaceId,
      userId,
      member.role !== "MEMBER",
    );
    const date = data.date ? new Date(`${data.date}T12:00:00Z`) : new Date();
    return this.generate(
      standupResult,
      "standup",
      "Draft a standup from this member's assigned tasks. Completed should only include recently updated completed tasks. List overdue work as follow-up, not an invented dependency blocker.",
      { date, tasks: taskContext(tasks) },
      () => generateStandup(tasks, date),
    );
  }
}

export default new AiService();
