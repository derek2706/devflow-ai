import type { TaskPriority } from "@prisma/client";

export interface PlanningTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: Date | null;
  updatedAt: Date;
  column: { name: string; isDone: boolean };
}

export function planSubtasks(task: Pick<PlanningTask, "title" | "priority">) {
  const title = task.title.slice(0, 130);
  return {
    subtasks: [
      {
        title: `Define acceptance criteria: ${title}`,
        description: `Clarify the expected behavior, edge cases, and a verifiable definition of done for “${title}”.`,
        priority: task.priority,
      },
      {
        title: `Implement: ${title}`,
        description: `Deliver the smallest complete implementation for “${title}”, following the project's existing conventions.`,
        priority: task.priority,
      },
      {
        title: `Verify and document: ${title}`,
        description:
          "Check the acceptance criteria, cover failure cases, and update the relevant documentation before review.",
        priority: "MEDIUM" as const,
      },
    ],
  };
}

export function summarizeProject(
  name: string,
  tasks: PlanningTask[],
  now = new Date(),
) {
  const done = tasks.filter((task) => task.column.isDone);
  const open = tasks.filter((task) => !task.column.isDone);
  const overdue = open.filter((task) => task.dueDate && task.dueDate < now);
  const urgent = open.filter((task) => task.priority === "URGENT");
  return {
    summary: `${name}: ${done.length} of ${tasks.length} tasks completed (${tasks.length ? Math.round((done.length / tasks.length) * 100) : 0}%). ${open.length} tasks remain.`,
    highlights: [
      ...done.slice(0, 3).map((task) => `Completed: ${task.title}`),
      ...(tasks.length === 0
        ? ["Create the first task to start tracking progress."]
        : [
            `${new Set(tasks.map((task) => task.column.name)).size} board statuses currently contain tasks.`,
          ]),
    ],
    risks: [
      ...overdue.slice(0, 5).map((task) => `Overdue: ${task.title}`),
      ...urgent
        .slice(0, 5)
        .map((task) => `Urgent work remaining: ${task.title}`),
    ],
  };
}

export function planSprint(
  tasks: PlanningTask[],
  goal: string | undefined,
  capacity: number,
) {
  const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const selected = tasks
    .filter((task) => !task.column.isDone)
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        (a.dueDate?.getTime() ?? Infinity) -
          (b.dueDate?.getTime() ?? Infinity) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, capacity);
  return {
    goal: goal || "Finish the highest-priority work and reduce overdue tasks.",
    tasks: selected.map((task) => ({
      taskId: task.id,
      title: task.title,
      reason: `${task.priority.toLowerCase()} priority${task.dueDate ? `; due ${task.dueDate.toISOString().slice(0, 10)}` : "; no due date"}`,
    })),
    notes: [
      "Capacity is a task count, not an estimate of hours or story points.",
      "Review dependencies and team availability before committing to this plan.",
    ],
  };
}

export function generateStandup(tasks: PlanningTask[], date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const previousDay = new Date(start.getTime() - 86_400_000);
  const nextDay = new Date(start.getTime() + 86_400_000);
  const open = tasks.filter((task) => !task.column.isDone);
  return {
    completed: tasks
      .filter(
        (task) =>
          task.column.isDone &&
          task.updatedAt >= previousDay &&
          task.updatedAt < nextDay,
      )
      .slice(0, 30)
      .map((task) => task.title),
    inProgress: open
      .slice(0, 30)
      .map((task) => `${task.title} (${task.column.name})`),
    blockers: open
      .filter((task) => task.dueDate && task.dueDate < start)
      .slice(0, 30)
      .map((task) => `Needs follow-up: ${task.title} is overdue.`),
  };
}
