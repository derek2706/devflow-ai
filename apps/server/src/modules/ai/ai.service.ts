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
} from "./ai.planner";
import { generateWithProvider, AiProviderFailure } from "./ai.provider";
import {
  taskContext,
  limitProviderContext,
  type AiContext,
} from "./ai.context";
import type { AiGeneration, AiStatus } from "./ai.types";
import {
  subtasksResult,
  summaryResult,
  sprintResult,
  standupResult,
  type sprintSchema,
  type standupSchema,
} from "./ai.validation";

class AiService {
  status(): AiStatus {
    const env = getEnv();
    return env.AI_MODE === "provider"
      ? { mode: "provider", provider: env.AI_PROVIDER, model: env.GROQ_MODEL }
      : { mode: "local" };
  }

  async generate<T>(
    schema: z.ZodType<T>,
    name: string,
    instruction: string,
    context: AiContext,
    local: () => T,
    accept?: (result: T, sent: AiContext) => T,
  ): Promise<AiGeneration<T>> {
    const status = this.status();
    const localResult = () => {
      const result = schema.parse(local());
      return accept ? accept(result, context) : result;
    };
    if (status.mode === "local")
      return { mode: "local", result: localResult() };

    const sent = limitProviderContext(context);
    try {
      const draft = await generateWithProvider(schema, name, instruction, sent);
      const result = accept ? accept(draft, sent) : draft;
      return { ...status, contextLimited: sent.contextLimited, result };
    } catch (error) {
      if (!(error instanceof AiProviderFailure)) throw error;
      return {
        ...status,
        mode: "local",
        fallbackReason: error.reason,
        contextLimited: sent.contextLimited,
        result: localResult(),
      };
    }
  }

  async subtasks(userId: string, taskId: string) {
    const task = await repository.findTask(prisma, taskId);
    if (!task) throw new ApiError(HTTP_STATUS.NOT_FOUND, "Task not found");
    await requireProjectAccess(prisma, task.projectId, userId);
    return this.generate(
      subtasksResult,
      "subtasks",
      "Break the task into 3–7 concrete, independently verifiable subtasks.",
      { tasks: taskContext([task]) },
      () => planSubtasks(task),
    );
  }

  async projectSummary(userId: string, projectId: string) {
    await requireProjectAccess(prisma, projectId, userId);
    const project = await repository.projectContext(prisma, projectId);
    if (!project)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
    return this.generate(
      summaryResult,
      "project_summary",
      "Summarize the supplied project snapshot, its progress, highlights, and concrete risks. The snapshot contains at most 200 recently updated tasks.",
      {
        name: project.name,
        description: project.description,
        totalTasks: project._count.tasks,
        tasks: taskContext(project.tasks),
        date: new Date().toISOString(),
        contextLimited: project._count.tasks > project.tasks.length,
      },
      () => summarizeProject(project.name, project.tasks),
      (draft, snapshot) => ({
        ...draft,
        summary:
          project._count.tasks > snapshot.tasks.length
            ? `Snapshot of the latest ${snapshot.tasks.length} of ${project._count.tasks} tasks. ${draft.summary}`.slice(
                0,
                5000,
              )
            : draft.summary,
      }),
    );
  }

  async sprintPlan(userId: string, data: z.infer<typeof sprintSchema>) {
    await requireProjectAccess(prisma, data.projectId, userId);
    const project = await repository.projectContext(prisma, data.projectId);
    if (!project)
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Project not found");
    return this.generate(
      sprintResult,
      "sprint_plan",
      `Propose a sprint using at most ${data.capacity} unfinished tasks from the provided snapshot. Use only supplied task IDs.`,
      {
        name: project.name,
        goal: data.goal,
        capacity: data.capacity,
        tasks: taskContext(project.tasks.filter((task) => !task.column.isDone)),
        date: new Date().toISOString(),
        contextLimited: project._count.tasks > project.tasks.length,
      },
      () => planSprint(project.tasks, data.goal, data.capacity),
      (draft, snapshot) => {
        // Validate against the exact snapshot sent, not tasks omitted by the budget.
        const allowed = new Map(
          snapshot.tasks
            .filter((task) => !task.completed)
            .map((task) => [task.id, task.title]),
        );
        const selected = draft.tasks.map((task) => task.taskId);
        if (
          selected.length > data.capacity ||
          new Set(selected).size !== selected.length ||
          selected.some((id) => !allowed.has(id))
        ) {
          throw new AiProviderFailure("invalid_response");
        }
        const notes = [...draft.notes];
        if (snapshot.contextLimited) {
          notes.splice(14);
          notes.push(
            `Candidates are limited to ${snapshot.tasks.length} unfinished tasks from the latest project snapshot.`,
          );
        }
        return {
          ...draft,
          tasks: draft.tasks.map((task) => ({
            ...task,
            title: allowed.get(task.taskId)!,
          })),
          notes,
        };
      },
    );
  }

  async standup(userId: string, data: z.infer<typeof standupSchema>) {
    const member = await requireWorkspaceMember(
      prisma,
      data.workspaceId,
      userId,
    );
    const found = await repository.standupTasks(
      prisma,
      data.workspaceId,
      userId,
      member.role !== "MEMBER",
    );
    const tasks = found.slice(0, 200);
    const date = data.date ? new Date(`${data.date}T12:00:00Z`) : new Date();
    return this.generate(
      standupResult,
      "standup",
      "Draft a standup from this member's assigned tasks. Completed should only include recently updated completed tasks. List overdue work as follow-up, not an invented dependency blocker.",
      {
        date: date.toISOString(),
        tasks: taskContext(tasks),
        contextLimited: found.length > tasks.length,
      },
      () => generateStandup(tasks, date),
    );
  }
}

export default new AiService();
