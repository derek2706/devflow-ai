import type { PlanningTask } from "./ai.planner";

export const MAX_PROVIDER_CONTEXT_CHARACTERS = 16_000;

// Explicit projection: never include comments, member profiles, or credentials.
export function taskContext(tasks: PlanningTask[]) {
  return tasks.map(
    ({ id, title, description, priority, dueDate, updatedAt, column }) => ({
      id,
      title,
      description,
      priority,
      dueDate: dueDate?.toISOString() ?? null,
      updatedAt: updatedAt.toISOString(),
      status: column.name,
      completed: column.isDone,
    }),
  );
}

export interface AiContext {
  tasks: ReturnType<typeof taskContext>;
  name?: string;
  description?: string;
  totalTasks?: number;
  goal?: string;
  capacity?: number;
  date?: string;
  contextLimited?: boolean;
}

export function limitProviderContext(context: AiContext) {
  let limited = Boolean(context.contextLimited);
  const clip = (value: string, maximum: number) => {
    if (value.length > maximum) limited = true;
    return value.slice(0, maximum);
  };
  const result: AiContext = {
    ...(context.name !== undefined && { name: clip(context.name, 120) }),
    ...(context.description !== undefined && {
      description: clip(context.description, 1000),
    }),
    ...(context.goal !== undefined && { goal: clip(context.goal, 500) }),
    ...(context.totalTasks !== undefined && { totalTasks: context.totalTasks }),
    ...(context.capacity !== undefined && { capacity: context.capacity }),
    ...(context.date !== undefined && { date: context.date }),
    tasks: [],
    // Reserve the longer false literal while measuring the serialized budget.
    contextLimited: false,
  };
  for (const task of context.tasks) {
    const candidate = {
      ...task,
      description: clip(task.description, 500),
    };
    result.tasks.push(candidate);
    if (JSON.stringify(result).length > MAX_PROVIDER_CONTEXT_CHARACTERS) {
      result.tasks.pop();
      limited = true;
      break;
    }
  }
  result.contextLimited = limited;
  return result;
}
