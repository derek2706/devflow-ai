/* eslint-disable @typescript-eslint/no-require-imports -- Render regressions run directly in Node.js. */
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const serverRequire = createRequire(
  require.resolve("../../server/package.json"),
);
const { register } = serverRequire("tsx/cjs/api");

// These assertions concern rendered content and controls, not CSS module names.
const { TaskForm, ProjectBoard, AiStatusNotice } = (() => {
  const unregister = register();
  const originalCssLoader = require.extensions[".css"];
  require.extensions[".css"] = (module) => {
    module.exports = {};
  };
  try {
    return {
      ...require("../src/features/tasks/task-form.tsx"),
      ...require("../src/features/projects/project-board.tsx"),
      ...require("../src/features/ai/ai-setup.tsx"),
    };
  } finally {
    if (originalCssLoader) require.extensions[".css"] = originalCssLoader;
    else delete require.extensions[".css"];
    unregister();
  }
})();

const noop = () => {};
const user = { id: "user-me", name: "Alex Developer" };
const teammate = { id: "user-other", name: "Sam Reviewer" };

function task(overrides = {}) {
  return {
    id: "task-existing",
    title: 'Release <candidate> & "review"',
    description: "Keep <checks> & sign-off",
    projectId: "project-one",
    columnId: "done",
    priority: "HIGH",
    dueDate: "2026-10-05T00:00:00.000Z",
    labels: ["release", "frontend"],
    position: 0,
    assigneeId: user.id,
    assignee: user,
    ...overrides,
  };
}

function project(columns) {
  return {
    id: "project-one",
    name: "Release project",
    color: "#123456",
    workspaceId: "workspace-one",
    members: [
      { userId: user.id, user, role: "MEMBER" },
      { userId: teammate.id, user: teammate, role: "MEMBER" },
    ],
    columns: columns || [
      { id: "todo", name: "To do", position: 0, isDone: false, tasks: [] },
      { id: "done", name: "Done", position: 1, isDone: true, tasks: [] },
    ],
  };
}

function render(component, props) {
  return renderToStaticMarkup(React.createElement(component, props));
}

function escapeHtml(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

function inputValue(html, name) {
  const input = [...html.matchAll(/<input\b[^>]*>/g)].find(([tag]) =>
    tag.includes(`name="${name}"`),
  );
  assert.ok(input, `Expected an input named ${name}`);
  return input[0].match(/\bvalue="([^"]*)"/)?.[1] || "";
}

function selectOptions(html, name) {
  const select = [
    ...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g),
  ].find(([tag]) => tag.includes(`name="${name}"`));
  assert.ok(select, `Expected a select named ${name}`);
  return [...select[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(
    ([, attributes, label]) => ({
      value: attributes.match(/\bvalue="([^"]*)"/)?.[1],
      selected: attributes.includes('selected=""'),
      label,
    }),
  );
}

function selectedValue(html, name) {
  const selected = selectOptions(html, name).filter(
    (option) => option.selected,
  );
  assert.equal(selected.length, 1, `Expected one selected ${name}`);
  return selected[0].value;
}

function renderTaskForm(props = {}) {
  return render(TaskForm, {
    project: project(),
    error: "",
    busy: false,
    onSubmit: noop,
    onDelete: noop,
    onCancel: noop,
    ...props,
  });
}

test("TaskForm retains existing task values and selects its status and assignee", () => {
  const existing = task();
  const html = renderTaskForm({ task: existing, columnId: "todo" });
  assert.equal(inputValue(html, "title"), escapeHtml(existing.title));
  assert.match(
    html,
    /<textarea\b[^>]*>Keep &lt;checks&gt; &amp; sign-off<\/textarea>/,
  );
  assert.equal(inputValue(html, "dueDate"), "2026-10-05");
  assert.equal(inputValue(html, "labels"), "release, frontend");
  assert.equal(selectedValue(html, "columnId"), "done");
  assert.equal(selectedValue(html, "priority"), "HIGH");
  assert.equal(selectedValue(html, "assigneeId"), user.id);
  assert.equal(
    selectOptions(html, "assigneeId").filter(
      (option) => option.value === user.id,
    ).length,
    1,
  );
  assert.ok(html.includes('aria-label="Delete task"'));
  assert.ok(html.includes("Save changes"));
});

test("TaskForm preserves a departed assignee, with a fallback display name", () => {
  for (const assignee of [{ id: "departed", name: "Former teammate" }, null]) {
    const html = renderTaskForm({
      task: task({ assigneeId: "departed", assignee }),
    });
    const selected = selectOptions(html, "assigneeId").find(
      (option) => option.selected,
    );
    assert.deepEqual(selected, {
      value: "departed",
      selected: true,
      label: assignee?.name || "Current assignee",
    });
  }
});

test("TaskForm defaults new tasks to medium priority, unassigned and the requested column", () => {
  for (const columnId of [undefined, "done"]) {
    const html = renderTaskForm({ columnId });
    assert.equal(selectedValue(html, "columnId"), columnId || "todo");
    assert.equal(selectedValue(html, "priority"), "MEDIUM");
    assert.equal(selectedValue(html, "assigneeId"), "");
    for (const field of ["title", "labels", "dueDate"]) {
      assert.equal(inputValue(html, field), "");
    }
    assert.match(html, /<textarea\b[^>]*><\/textarea>/);
    assert.ok(html.includes("Create task"));
    assert.ok(!html.includes('aria-label="Delete task"'));
  }
});

const boardTasks = [
  task({
    id: "release-title",
    title: "Release candidate",
    description: "Ship tests",
    labels: [],
    dueDate: null,
    columnId: "todo",
    position: 3,
  }),
  task({
    id: "release-description",
    title: "Write documentation",
    description: "Release notes",
    labels: [],
    dueDate: null,
    columnId: "todo",
    priority: "LOW",
    position: 1,
  }),
  task({
    id: "release-label",
    title: "Audit permissions",
    description: "Review access",
    labels: ["release"],
    dueDate: null,
    columnId: "todo",
    assigneeId: teammate.id,
    assignee: teammate,
    position: 2,
  }),
  task({
    id: "unrelated",
    title: "Fix parser",
    description: "Edge cases",
    labels: [],
    dueDate: null,
    columnId: "todo",
    position: 0,
  }),
  task({
    id: "release-unassigned",
    title: "Release handoff",
    description: "Share results",
    labels: [],
    dueDate: null,
    columnId: "todo",
    assigneeId: null,
    assignee: null,
    position: 4,
  }),
];

function renderBoard(filters = {}, props = {}) {
  return render(ProjectBoard, {
    project: project([
      {
        id: "todo",
        name: "To do",
        position: 0,
        isDone: false,
        tasks: boardTasks,
      },
    ]),
    filters: { search: "", priority: "", mine: false, ...filters },
    user,
    canManage: false,
    moving: false,
    dragOver: "",
    onFiltersChange: noop,
    onDragOver: noop,
    onMoveTask: noop,
    onEditColumn: noop,
    onCreateColumn: noop,
    onCreateTask: noop,
    onOpenTask: noop,
    onGenerateAi: noop,
    ...props,
  });
}

for (const [name, filters, expectedTitles] of [
  [
    "all tasks",
    {},
    [
      "Fix parser",
      "Write documentation",
      "Audit permissions",
      "Release candidate",
      "Release handoff",
    ],
  ],
  [
    "case-insensitive title, description and label search",
    { search: "RELEASE" },
    [
      "Write documentation",
      "Audit permissions",
      "Release candidate",
      "Release handoff",
    ],
  ],
  [
    "priority",
    { priority: "HIGH" },
    ["Fix parser", "Audit permissions", "Release candidate", "Release handoff"],
  ],
  [
    "mine",
    { mine: true },
    ["Fix parser", "Write documentation", "Release candidate"],
  ],
  [
    "search and priority",
    { search: "release", priority: "HIGH" },
    ["Audit permissions", "Release candidate", "Release handoff"],
  ],
  [
    "search and mine",
    { search: "release", mine: true },
    ["Write documentation", "Release candidate"],
  ],
  [
    "priority and mine",
    { priority: "HIGH", mine: true },
    ["Fix parser", "Release candidate"],
  ],
  [
    "all filters",
    { search: "release", priority: "HIGH", mine: true },
    ["Release candidate"],
  ],
  ["no matches", { search: "missing" }, []],
]) {
  test(`ProjectBoard filters ${name} and preserves task order`, () => {
    const html = renderBoard(filters);
    const renderedTitles = [
      ...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g),
    ].map(
      ([, article]) =>
        article.match(/<button\b[^>]*>([\s\S]*?)<\/button>/)?.[1],
    );
    assert.deepEqual(renderedTitles, expectedTitles.map(escapeHtml));
    assert.equal(
      html.includes("No tasks match your filters"),
      expectedTitles.length === 0,
    );
    assert.ok(html.includes(`aria-pressed="${Boolean(filters.mine)}"`));
  });
}

test("ProjectBoard restricts column management while allowing members to add tasks", () => {
  for (const canManage of [false, true]) {
    const html = renderBoard({}, { canManage });
    assert.equal(html.includes('aria-label="Edit To do column"'), canManage);
    assert.equal(html.includes("Add column"), canManage);
    assert.ok(html.includes('aria-label="Add task to To do"'));
    assert.ok(html.includes("AI summary"));
    assert.ok(html.includes("Plan a sprint"));
  }
});

test("AiStatusNotice distinguishes configured Groq from a generated provider result", () => {
  const ready = render(AiStatusNotice, { mode: "provider", result: null });
  assert.ok(ready.includes("AI via Groq"));
  assert.ok(
    ready.includes("Sends project/task content to Groq when you generate"),
  );
  assert.ok(!ready.includes("Generated by Groq"));
  for (const contextLimited of [false, true]) {
    const html = render(AiStatusNotice, {
      mode: "provider",
      result: {
        mode: "provider",
        provider: "groq",
        contextLimited,
        result: {},
      },
    });
    assert.ok(html.includes("Generated by Groq"));
    assert.equal(html.includes("shortened snapshot"), contextLimited);
    assert.ok(!html.includes("Local planning assistant"));
    assert.ok(!html.includes('role="alert"'));
  }
});

test("AiStatusNotice labels intentional local mode without implying an AI attempt", () => {
  const html = render(AiStatusNotice, { mode: "local", result: null });
  assert.ok(html.includes("Local planning assistant"));
  assert.ok(html.includes("Rule-based suggestions · no external service"));
  assert.ok(!html.includes("Groq"));
  assert.ok(!html.includes("after an AI attempt"));
  assert.ok(!html.includes('role="status"'));
});

for (const [fallbackReason, message] of [
  ["quota", "AI allowance or rate limit has been reached"],
  ["timeout", "AI took too long to respond"],
  ["unavailable", "AI is temporarily unavailable"],
  ["invalid_response", "AI response could not be verified"],
]) {
  test(`AiStatusNotice truthfully labels ${fallbackReason} fallback as local`, () => {
    const html = render(AiStatusNotice, {
      mode: "local",
      result: {
        mode: "local",
        fallbackReason,
        contextLimited: true,
        result: {},
      },
    });
    assert.ok(html.includes("Local planning assistant"));
    assert.ok(html.includes("Local draft after an AI attempt"));
    assert.ok(html.includes(message));
    assert.ok(html.includes('role="status"'));
    assert.ok(!html.includes("no external service"));
    assert.ok(!html.includes("Generated by Groq"));
    assert.ok(!html.includes("shortened snapshot"));
  });
}

test("AiStatusNotice exposes configuration/status errors without inventing a local fallback", () => {
  const error = "AI configuration invalid <check settings> & retry";
  const html = render(AiStatusNotice, { result: null, error });
  assert.ok(html.includes("Checking assistant…"));
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes(escapeHtml(error)));
  assert.ok(!html.includes("Local planning assistant"));
  assert.ok(!html.includes("local planner prepared"));
  assert.ok(!html.includes("Generated by Groq"));
});
