"use client";
import styles from "./project.module.css";
import { cx } from "../lib/class-names";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { errorText, itemOf, listOf, patch, post, remove } from "../lib/api";
import { Column, Member, Project, Task, User, Workspace } from "../lib/types";
import {
  Avatar,
  dateLabel,
  Empty,
  ErrorBanner,
  Icon,
  Loading,
  Modal,
  PriorityBadge,
  useResource,
} from "./ui";
import { ProjectEditor } from "./editors";
import { TaskEditor } from "./task";
import { AiPanel } from "./ai";

export function ProjectView({
  id,
  user,
  workspaces,
  onWorkspace,
  onChange,
}: {
  id: string;
  user: User;
  workspaces: Workspace[];
  onWorkspace: (id: string) => void;
  onChange: () => void;
}) {
  const router = useRouter();
  const resource = useResource<{ project: Project }>(`/projects/${id}`);
  const project = resource.data
    ? itemOf<Project>(resource.data, "project")
    : undefined;
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [mine, setMine] = useState(false);
  const [settings, setSettings] = useState(false);
  const [members, setMembers] = useState(false);
  const [columnEditor, setColumnEditor] = useState<Column | "new" | null>(null);
  const [taskEditor, setTaskEditor] = useState<{
    task?: Task;
    columnId?: string;
  } | null>(null);
  const [ai, setAi] = useState<"project-summary" | "sprint-plan" | null>(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [dragOver, setDragOver] = useState("");
  const workspace = workspaces.find((w) => w.id === project?.workspaceId);
  const canManage =
    workspace?.role === "OWNER" ||
    workspace?.role === "ADMIN" ||
    project?.createdById === user.id;
  useEffect(() => {
    if (project?.workspaceId) onWorkspace(project.workspaceId);
  }, [project?.workspaceId, onWorkspace]);
  useEffect(() => {
    if (!project) return;
    const taskId = new URLSearchParams(window.location.search).get("task");
    const task = project.columns
      ?.flatMap((column) => column.tasks)
      .find((task) => task.id === taskId);
    if (task) queueMicrotask(() => setTaskEditor({ task }));
  }, [project]);
  function refresh() {
    resource.refresh();
    onChange();
  }
  async function moveTask(taskId: string, columnId: string, position: number) {
    if (
      !project?.columns.some((column) =>
        column.tasks.some((task) => task.id === taskId),
      )
    )
      return;
    setMoving(true);
    setError("");
    setDragOver("");
    try {
      await patch(`/tasks/${taskId}/move`, { columnId, position });
      resource.refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setMoving(false);
    }
  }
  async function deleteProject() {
    if (
      !window.confirm(
        `Delete “${project?.name}” and all its tasks? This cannot be undone.`,
      )
    )
      return;
    try {
      await remove(`/projects/${id}`);
      onChange();
      router.push(`/workspaces/${project?.workspaceId}`);
    } catch (error) {
      setError(errorText(error));
    }
  }
  if (!project)
    return (
      <>
        <ErrorBanner error={resource.error} />
        {resource.loading && <Loading label="Opening your project…" />}
      </>
    );
  const taskCount = project.columns.reduce(
    (count, column) => count + column.tasks.length,
    0,
  );
  const doneCount = project.columns
    .filter((column) => column.isDone)
    .reduce((count, column) => count + column.tasks.length, 0);
  return (
    <>
      <div className={cx(styles["page-heading"], styles["project-heading"])}>
        <div className={styles["project-heading-title"]}>
          <span
            className={cx(styles["project-icon"], styles["large"])}
            style={{
              color: project.color,
              backgroundColor: `${project.color}18`,
            }}
          >
            <Icon name="folder" size={26} />
          </span>
          <div>
            <span className={styles["eyebrow"]}>
              {workspace?.name || "YOUR PROJECT"}
            </span>
            <h1 className={styles["native-h1"]}>{project.name}</h1>
            <p className={styles["native-p"]}>
              {project.description ||
                "Every great project starts with a clear next step."}
            </p>
          </div>
        </div>
        <div className={styles["button-row"]}>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["secondary"],
            )}
            onClick={() => setMembers(true)}
          >
            <Icon name="users" size={17} />
            Members
          </button>
          {canManage && (
            <button
              className={cx(
                styles["native-button"],
                styles["icon-button"],
                styles["bordered"],
              )}
              onClick={() => setSettings(true)}
              aria-label="Project settings"
              title="Project settings"
            >
              <Icon name="settings" />
            </button>
          )}
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            onClick={() => setTaskEditor({ columnId: project.columns[0]?.id })}
            disabled={!project.columns.length}
          >
            <Icon name="plus" size={17} />
            New task
          </button>
        </div>
      </div>
      <div className={styles["project-tabs"]}>
        <span className={styles["selected"]}>
          <Icon name="board" size={17} />
          Board<span className={styles["count"]}>{taskCount}</span>
        </span>
        <div className={styles["project-completion"]}>
          <span className={styles["tiny-progress"]}>
            <span
              style={{
                width: `${taskCount ? (doneCount / taskCount) * 100 : 0}%`,
              }}
            />
          </span>
          {doneCount} of {taskCount} completed
        </div>
        <div className={styles["avatar-stack"]}>
          {project.members.slice(0, 4).map((member) => (
            <Avatar
              key={member.userId}
              name={member.user.name}
              size="small"
              className={styles.stackAvatar}
            />
          ))}
        </div>
      </div>
      <div className={styles["board-toolbar"]}>
        <div className={styles["board-filters"]}>
          <label className={cx(styles["native-label"], styles["search-field"])}>
            <Icon name="search" size={17} />
            <input
              className={styles["native-input"]}
              placeholder="Search tasks…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search tasks"
            />
          </label>
          <select
            className={styles["native-select"]}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            {["URGENT", "HIGH", "MEDIUM", "LOW"].map((value) => (
              <option key={value} value={value}>
                {value[0] + value.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["quiet"],
              mine ? styles["selected-filter"] : undefined,
            )}
            aria-pressed={mine}
            onClick={() => setMine(!mine)}
          >
            <Avatar
              name={user.name}
              size="small"
              className={styles.filterAvatar}
            />
            My tasks
          </button>
        </div>
        <div className={styles["button-row"]}>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["ai-button"],
            )}
            onClick={() => setAi("project-summary")}
          >
            <Icon name="sparkle" size={16} />
            AI summary
          </button>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["quiet"],
            )}
            onClick={() => setAi("sprint-plan")}
          >
            Plan a sprint
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </div>
      <ErrorBanner error={error || resource.error} />
      {moving && (
        <div className={styles["board-status"]} role="status">
          Moving task…
        </div>
      )}
      <div className={styles["kanban-board"]} aria-label="Project Kanban board">
        {[...project.columns]
          .sort((a, b) => a.position - b.position)
          .map((column, index) => {
            const visible = [...column.tasks]
              .sort((a, b) => a.position - b.position)
              .filter(
                (task) =>
                  (!search ||
                    `${task.title} ${task.description || ""} ${(task.labels || []).join(" ")}`
                      .toLowerCase()
                      .includes(search.toLowerCase())) &&
                  (!priority || task.priority === priority) &&
                  (!mine || task.assigneeId === user.id),
              );
            return (
              <section
                key={column.id}
                className={cx(
                  styles["kanban-column"],
                  dragOver === column.id ? styles["drag-over"] : undefined,
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOver(column.id);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  )
                    setDragOver("");
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void moveTask(
                    event.dataTransfer.getData("text/task-id"),
                    column.id,
                    column.tasks.length,
                  );
                }}
              >
                <div className={styles["column-heading"]}>
                  <span
                    className={cx(
                      styles["column-dot"],
                      column.isDone && styles.done,
                      !column.isDone && index % 3 === 1 && styles["tone-1"],
                      !column.isDone && index % 3 === 2 && styles["tone-2"],
                    )}
                  />
                  <h2 className={styles["native-h2"]}>{column.name}</h2>
                  <span className={styles["count"]}>{visible.length}</span>
                  {canManage && (
                    <button
                      className={cx(
                        styles["native-button"],
                        styles["icon-button"],
                      )}
                      aria-label={`Edit ${column.name} column`}
                      onClick={() => setColumnEditor(column)}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  )}
                  <button
                    className={cx(
                      styles["native-button"],
                      styles["icon-button"],
                    )}
                    aria-label={`Add task to ${column.name}`}
                    onClick={() => setTaskEditor({ columnId: column.id })}
                  >
                    <Icon name="plus" size={17} />
                  </button>
                </div>
                <div className={styles["column-tasks"]}>
                  {visible.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      complete={column.isDone}
                      onOpen={() => setTaskEditor({ task })}
                      disabled={moving}
                      onDrop={(taskId) =>
                        moveTask(taskId, column.id, task.position)
                      }
                    />
                  ))}
                  {!visible.length && (
                    <div className={styles["column-empty"]}>
                      {column.tasks.length
                        ? "No tasks match your filters"
                        : "Space for your next step"}
                    </div>
                  )}
                </div>
                <button
                  className={cx(
                    styles["native-button"],
                    styles["add-task-button"],
                  )}
                  onClick={() => setTaskEditor({ columnId: column.id })}
                >
                  <Icon name="plus" size={16} />
                  Add task
                </button>
              </section>
            );
          })}
        {canManage && (
          <button
            className={cx(styles["native-button"], styles["add-column"])}
            onClick={() => setColumnEditor("new")}
          >
            <Icon name="plus" size={18} />
            Add column
          </button>
        )}
      </div>
      <p className={cx(styles["native-p"], styles["board-hint"])}>
        <Icon name="board" size={14} />
        Drag tasks between columns, or open a task and change its status.
      </p>
      {settings && (
        <>
          <ProjectEditor
            project={project}
            workspaceId={project.workspaceId}
            onClose={() => setSettings(false)}
            onSave={() => {
              setSettings(false);
              refresh();
            }}
          />
        </>
      )}
      {canManage && (
        <div className={styles["project-danger-link"]}>
          <button className={styles["native-button"]} onClick={deleteProject}>
            Delete project
          </button>
        </div>
      )}
      {members && (
        <ProjectMembers
          project={project}
          canManage={canManage}
          onClose={() => setMembers(false)}
          onChange={refresh}
        />
      )}
      {canManage && columnEditor && (
        <ColumnEditor
          project={project}
          column={columnEditor === "new" ? undefined : columnEditor}
          onClose={() => setColumnEditor(null)}
          onChange={() => {
            setColumnEditor(null);
            refresh();
          }}
        />
      )}
      {taskEditor && (
        <TaskEditor
          project={project}
          task={taskEditor.task}
          columnId={taskEditor.columnId}
          user={user}
          onClose={() => {
            setTaskEditor(null);
            resource.refresh();
            if (window.location.search)
              router.replace(`/projects/${id}`, { scroll: false });
          }}
          onChange={() => {
            setTaskEditor(null);
            router.replace(`/projects/${id}`, { scroll: false });
            refresh();
          }}
        />
      )}
      {ai && (
        <AiPanel type={ai} project={project} onClose={() => setAi(null)} />
      )}
    </>
  );
}
function TaskCard({
  task,
  complete,
  onOpen,
  onDrop,
  disabled,
}: {
  task: Task;
  complete: boolean;
  onOpen: () => void;
  onDrop: (id: string) => void;
  disabled: boolean;
}) {
  const overdue =
    !complete && task.dueDate && new Date(task.dueDate) < new Date();
  return (
    <article
      className={styles["task-card"]}
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/task-id", task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(event.dataTransfer.getData("text/task-id"));
      }}
    >
      <div className={styles["task-labels"]}>
        {task.labels?.slice(0, 3).map((label) => (
          <span key={label}>{label}</span>
        ))}
        {complete && (
          <span className={styles["completed-label"]}>
            <Icon name="check" size={11} />
            Done
          </span>
        )}
      </div>
      <button
        className={cx(styles["native-button"], styles["task-title"])}
        onClick={onOpen}
      >
        {task.title}
      </button>
      {task.description && (
        <p className={cx(styles["native-p"], styles["task-description"])}>
          {task.description}
        </p>
      )}
      <div className={styles["task-card-meta"]}>
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span
            className={cx(
              styles["due-date"],
              overdue ? styles["overdue"] : undefined,
            )}
          >
            <Icon name="calendar" size={12} />
            {dateLabel(task.dueDate)}
          </span>
        )}
      </div>
      <div className={styles["task-card-footer"]}>
        <span>
          {task._count?.comments ? (
            <>
              <Icon name="chat" size={14} />
              {task._count.comments}
            </>
          ) : (
            <span className={styles["task-id"]}>
              {task.id.slice(-6).toUpperCase()}
            </span>
          )}
        </span>
        {task.assignee ? (
          <Avatar
            name={task.assignee.name}
            size="small"
            className={styles.taskAvatar}
          />
        ) : (
          <span className={styles["unassigned"]} title="Unassigned">
            <Icon name="users" size={13} />
          </span>
        )}
      </div>
    </article>
  );
}
function ColumnEditor({
  project,
  column,
  onClose,
  onChange,
}: {
  project: Project;
  column?: Column;
  onClose: () => void;
  onChange: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      isDone: form.get("isDone") === "on",
      ...(column ? { position: Number(form.get("position")) } : {}),
    };
    try {
      if (column) await patch(`/columns/${column.id}`, body);
      else await post(`/projects/${project.id}/columns`, body);
      onChange();
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  async function deleteColumn() {
    if (
      !window.confirm(
        `Delete “${column?.name}”? Move its tasks to another column first.`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove(`/columns/${column?.id}`);
      onChange();
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={column ? "Edit column" : "Add a column"}
      description="Shape the board around how your team works."
      onClose={onClose}
    >
      <form className={styles["form-stack"]} onSubmit={submit}>
        <ErrorBanner error={error} />
        <label className={styles["native-label"]}>
          Column name
          <input
            className={styles["native-input"]}
            name="name"
            defaultValue={column?.name}
            placeholder="In review"
            maxLength={80}
            required
            autoFocus
          />
        </label>
        {column && (
          <label className={styles["native-label"]}>
            Board position
            <select
              className={styles["native-select"]}
              name="position"
              defaultValue={column.position}
            >
              {project.columns.map((entry, index) => (
                <option value={index} key={entry.id}>
                  {index + 1}
                  {index === 0
                    ? " — first"
                    : index === project.columns.length - 1
                      ? " — last"
                      : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={cx(styles["native-label"], styles["checkbox-label"])}>
          <input
            className={styles["native-input"]}
            type="checkbox"
            name="isDone"
            defaultChecked={column?.isDone}
          />
          Tasks in this column are completed
        </label>
        <p className={cx(styles["native-p"], styles["helper"])}>
          Completed columns count toward project progress and dashboard totals.
        </p>
        <div className={styles["modal-actions"]}>
          {column && (
            <button
              type="button"
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["danger-button"],
              )}
              onClick={deleteColumn}
              disabled={busy || !!column.tasks.length}
              title={
                column.tasks.length
                  ? "Move all tasks before deleting this column"
                  : undefined
              }
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["secondary"],
            )}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            disabled={busy}
          >
            {busy ? "Saving…" : column ? "Save changes" : "Add column"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ProjectMembers({
  project,
  canManage,
  onClose,
  onChange,
}: {
  project: Project;
  canManage: boolean;
  onClose: () => void;
  onChange: () => void;
}) {
  const resource = useResource<{ members: Member[] }>(
    `/workspaces/${project.workspaceId}/members`,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const available = listOf<Member>(resource.data, "members").filter(
    (member) =>
      !project.members.some((existing) => existing.userId === member.userId),
  );
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post(`/projects/${project.id}/members`, {
        userId: form.get("userId"),
      });
      onChange();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function deleteMember(member: Member) {
    if (!window.confirm(`Remove ${member.user.name} from the project team?`))
      return;
    setBusy(true);
    try {
      await remove(`/projects/${project.id}/members/${member.userId}`);
      onChange();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Your project team"
      description="Add workspace teammates to grant project access and assign them tasks."
      onClose={onClose}
    >
      <ErrorBanner error={error || resource.error} />
      <div className={cx(styles["member-list"], styles["compact"])}>
        {project.members.map((member) => (
          <div className={styles["member-row"]} key={member.userId}>
            <Avatar name={member.user.name} className={styles.memberAvatar} />
            <strong className={styles["member-name"]}>
              {member.user.name}
            </strong>
            {canManage && member.userId !== project.createdById && (
              <button
                className={cx(
                  styles["native-button"],
                  styles["icon-button"],
                  styles["danger"],
                )}
                disabled={busy}
                onClick={() => deleteMember(member)}
                aria-label={`Remove ${member.user.name}`}
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!project.members.length && (
        <Empty
          icon="users"
          title="Build your project team"
          description="Add people from the workspace to assign them tasks."
        />
      )}
      {canManage && (
        <form className={styles["form-stack"]} onSubmit={add}>
          <label className={styles["native-label"]}>
            Add a workspace member
            <select
              className={styles["native-select"]}
              name="userId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                {available.length
                  ? "Choose a teammate"
                  : "All workspace members are on this project"}
              </option>
              {available.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            disabled={busy || !available.length}
          >
            {busy ? "Saving…" : "Add to project"}
          </button>
        </form>
      )}
    </Modal>
  );
}
