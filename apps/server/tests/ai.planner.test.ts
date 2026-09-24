import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateStandup,
  planSprint,
  planSubtasks,
  summarizeProject,
  type PlanningTask,
} from "../src/modules/ai/ai.planner";

const now = new Date("2026-09-24T12:00:00Z");
function task(id: string, values: Partial<PlanningTask> = {}): PlanningTask {
  return {
    id,
    title: id,
    description: "",
    priority: "MEDIUM",
    dueDate: null,
    updatedAt: now,
    column: { name: "To do", isDone: false },
    ...values,
  };
}

test("sprint selects unfinished tasks in priority/due order and respects capacity", () => {
  const tasks = [
    task("normal"),
    task("high", { priority: "HIGH" }),
    task("urgent", { priority: "URGENT" }),
    task("earlier", { priority: "HIGH", dueDate: now }),
    task("done", {
      priority: "URGENT",
      column: { name: "Shipped", isDone: true },
    }),
  ];
  const before = tasks.map((item) => item.id);
  const plan = planSprint(tasks, "Launch", 3);
  assert.deepEqual(
    plan.tasks.map((item) => item.taskId),
    ["urgent", "earlier", "high"],
  );
  assert.equal(plan.goal, "Launch");
  assert.deepEqual(
    tasks.map((item) => item.id),
    before,
  );
});

test("summary uses explicit completed status even for custom column names", () => {
  const summary = summarizeProject(
    "API",
    [
      task("one", { column: { name: "Released", isDone: true } }),
      task("two", { dueDate: new Date("2026-09-20") }),
    ],
    now,
  );
  assert.match(summary.summary, /1 of 2.*50%/);
  assert.deepEqual(summary.risks, ["Overdue: two"]);
  assert.match(summarizeProject("Empty", [], now).summary, /0%/);
});

test("standup excludes old/future completions and reports overdue follow-ups", () => {
  const done = { name: "Done", isDone: true };
  const result = generateStandup(
    [
      task("recent", { column: done }),
      task("old", { column: done, updatedAt: new Date("2026-09-21") }),
      task("future", { column: done, updatedAt: new Date("2026-09-27") }),
      task("due", { dueDate: new Date("2026-09-20") }),
    ],
    now,
  );
  assert.deepEqual(result.completed, ["recent"]);
  assert.deepEqual(result.inProgress, ["due (To do)"]);
  assert.deepEqual(result.blockers, ["Needs follow-up: due is overdue."]);
});

test("subtasks preserve task priority and produce bounded editable titles", () => {
  const result = planSubtasks({ title: "A".repeat(200), priority: "HIGH" });
  assert.equal(result.subtasks.length, 3);
  assert.equal(result.subtasks[0].priority, "HIGH");
  assert.ok(
    result.subtasks.every(
      (item) => item.title.length <= 200 && item.description.length > 0,
    ),
  );
});
