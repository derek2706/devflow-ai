import assert from "node:assert/strict";
import { test } from "node:test";
import {
  limitProviderContext,
  MAX_PROVIDER_CONTEXT_CHARACTERS,
  taskContext,
} from "../src/modules/ai/ai.context";
import type { PlanningTask } from "../src/modules/ai/ai.planner";

function task(index: number): PlanningTask {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Task ${index}`,
    description: "Task details",
    priority: "MEDIUM",
    dueDate: null,
    updatedAt: new Date("2026-09-24T12:00:00Z"),
    column: { name: "To do", isDone: false },
  };
}

test("AI task context excludes unrelated private fields and serializes dates", () => {
  const source = {
    ...task(1),
    comments: [{ content: "private comment" }],
    user: { email: "private@example.test", password: "private password" },
    assigneeId: "private assignee",
  };
  assert.deepEqual(taskContext([source]), [
    {
      id: source.id,
      title: source.title,
      description: source.description,
      priority: "MEDIUM",
      dueDate: null,
      updatedAt: "2026-09-24T12:00:00.000Z",
      status: "To do",
      completed: false,
    },
  ]);
});

test("provider context preserves small snapshots without falsely reporting truncation", () => {
  const source = { name: "Project", tasks: taskContext([task(1)]) };
  assert.deepEqual(limitProviderContext(source), {
    ...source,
    contextLimited: false,
  });
  assert.equal("contextLimited" in source, false);
});

test("provider input stays within its serialized limit without modifying the local snapshot", () => {
  const tasks = Array.from({ length: 200 }, (_, index) => ({
    ...task(index),
    description: '"\\\n'.repeat(4000),
  }));
  const source = {
    name: "Project",
    description: "x".repeat(10000),
    totalTasks: 200,
    tasks: taskContext(tasks),
  };
  const before = JSON.stringify(source);
  const bounded = limitProviderContext(source);
  assert.equal(bounded.contextLimited, true);
  assert.ok(bounded.tasks.length > 0 && bounded.tasks.length < 200);
  assert.ok(JSON.stringify(bounded).length <= MAX_PROVIDER_CONTEXT_CHARACTERS);
  assert.equal(bounded.description?.length, 1000);
  assert.ok(bounded.tasks.every((item) => item.description.length <= 500));
  assert.equal(JSON.stringify(source), before);
});

test("provider context keeps an existing repository snapshot limitation", () => {
  assert.equal(
    limitProviderContext({
      tasks: taskContext([task(1)]),
      contextLimited: true,
    }).contextLimited,
    true,
  );
});
