"use client";
import styles from "./task.module.css";
import { cx } from "../lib/class-names";

import { FormEvent, useState } from "react";
import { errorText, listOf, patch, post, remove } from "../lib/api";
import { Comment, Project, Role, Task, User } from "../lib/types";
import {
  Avatar,
  ErrorBanner,
  Icon,
  Loading,
  Modal,
  timeAgo,
  useResource,
} from "./ui";
import { AiPanel } from "./ai";

export function TaskEditor({
  project,
  task,
  columnId,
  user,
  workspaceRole,
  onClose,
  onChange,
}: {
  project: Project;
  task?: Task;
  columnId?: string;
  user: User;
  workspaceRole?: Role;
  onClose: (changed: boolean) => void;
  onChange: (taskCountChanged: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const [changed, setChanged] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = {
      title: form.get("title"),
      description: form.get("description"),
      priority: form.get("priority"),
      labels: [
        ...new Set(
          String(form.get("labels") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
      dueDate: form.get("dueDate")
        ? new Date(String(form.get("dueDate"))).toISOString()
        : null,
      assigneeId: form.get("assigneeId") || null,
    };
    const targetColumn = String(form.get("columnId"));
    if (
      body.labels.length > 20 ||
      body.labels.some((label) => label.length > 32)
    ) {
      setError("Use up to 20 labels, each 32 characters or fewer.");
      setBusy(false);
      return;
    }
    try {
      if (task) {
        await patch(`/tasks/${task.id}`, body);
        // Preserve a successful edit if a subsequent status move fails.
        setChanged(true);
        if (task.columnId !== targetColumn)
          await patch(`/tasks/${task.id}/move`, {
            columnId: targetColumn,
            position:
              project.columns.find((column) => column.id === targetColumn)
                ?.tasks.length || 0,
          });
      } else
        await post(`/projects/${project.id}/tasks`, {
          ...body,
          columnId: targetColumn,
        });
      onChange(!task);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  async function deleteTask() {
    if (
      !window.confirm(
        `Delete “${task?.title}” and its comments? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove(`/tasks/${task?.id}`);
      onChange(true);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title={task ? "Task details" : "A clear next step"}
        description={project.name}
        onClose={() => onClose(changed)}
        wide
      >
        <div className={styles["task-detail-layout"]}>
          <div className={styles["task-detail-main"]}>
            <form className={styles["form-stack"]} onSubmit={save}>
              <ErrorBanner error={error} />
              <label className={styles["native-label"]}>
                Task title
                <input
                  name="title"
                  defaultValue={task?.title}
                  placeholder="What needs to happen?"
                  className={cx(
                    styles["native-input"],
                    styles["task-title-input"],
                  )}
                  maxLength={200}
                  required
                  autoFocus
                />
              </label>
              <label className={styles["native-label"]}>
                Description
                <textarea
                  className={styles["native-textarea"]}
                  name="description"
                  defaultValue={task?.description || ""}
                  placeholder="Add context, acceptance criteria, or a few helpful links…"
                  rows={5}
                  maxLength={10000}
                />
              </label>
              <div className={styles["form-grid"]}>
                <label className={styles["native-label"]}>
                  Status
                  <select
                    className={styles["native-select"]}
                    name="columnId"
                    defaultValue={
                      task?.columnId || columnId || project.columns[0]?.id
                    }
                    required
                  >
                    {project.columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                        {column.isDone ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles["native-label"]}>
                  Priority
                  <select
                    className={styles["native-select"]}
                    name="priority"
                    defaultValue={task?.priority || "MEDIUM"}
                  >
                    {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority[0] + priority.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles["native-label"]}>
                  Assignee
                  <select
                    className={styles["native-select"]}
                    name="assigneeId"
                    defaultValue={task?.assigneeId || ""}
                  >
                    <option value="">Unassigned</option>
                    {project.members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user.name}
                      </option>
                    ))}
                    {task?.assigneeId &&
                      !project.members.some(
                        (member) => member.userId === task.assigneeId,
                      ) && (
                        <option value={task.assigneeId}>
                          {task.assignee?.name || "Current assignee"}
                        </option>
                      )}
                  </select>
                </label>
                <label className={styles["native-label"]}>
                  Due date
                  <input
                    className={styles["native-input"]}
                    type="date"
                    name="dueDate"
                    defaultValue={task?.dueDate?.slice(0, 10) || ""}
                  />
                </label>
              </div>
              <label className={styles["native-label"]}>
                Labels
                <input
                  className={styles["native-input"]}
                  name="labels"
                  defaultValue={task?.labels?.join(", ")}
                  placeholder="design, frontend, release"
                  maxLength={680}
                />
                <span className={styles["helper"]}>
                  Separate labels with commas. Up to 20 labels, 32 characters
                  each.
                </span>
              </label>
              <div className={styles["modal-actions"]}>
                {task && (
                  <button
                    type="button"
                    className={cx(
                      styles["native-button"],
                      styles["icon-button"],
                      styles["danger"],
                    )}
                    onClick={deleteTask}
                    disabled={busy}
                    aria-label="Delete task"
                  >
                    <Icon name="trash" size={19} />
                  </button>
                )}
                <button
                  type="button"
                  className={cx(
                    styles["native-button"],
                    styles["button"],
                    styles["secondary"],
                  )}
                  onClick={() => onClose(changed)}
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
                  {busy ? "Saving…" : task ? "Save changes" : "Create task"}
                </button>
              </div>
            </form>
          </div>
          <aside className={styles["task-detail-aside"]}>
            {task ? (
              <>
                <div className={styles["task-ai-card"]}>
                  <span className={cx(styles["ai-orb"], styles["small"])}>
                    <Icon name="sparkle" size={22} />
                  </span>
                  <h3 className={styles["native-h3"]}>
                    Big task? Small steps.
                  </h3>
                  <p className={styles["native-p"]}>
                    Get a starting point for breaking this task into manageable
                    pieces.
                  </p>
                  <button
                    className={cx(
                      styles["native-button"],
                      styles["button"],
                      styles["ai-button"],
                      styles["full"],
                    )}
                    onClick={() => setAi(true)}
                  >
                    <Icon name="sparkle" size={16} />
                    Generate subtasks
                  </button>
                  <small>Uses the last saved task details.</small>
                </div>
                <Comments
                  taskId={task.id}
                  user={user}
                  canModerate={
                    workspaceRole === "OWNER" || workspaceRole === "ADMIN"
                  }
                  onChange={() => setChanged(true)}
                />
              </>
            ) : (
              <div className={styles["task-ai-card"]}>
                <Icon name="board" size={28} />
                <h3 className={styles["native-h3"]}>
                  Clarity creates momentum.
                </h3>
                <p className={styles["native-p"]}>
                  A clear title and a little context help everyone take the next
                  step.
                </p>
                <p className={styles["native-p"]}>
                  After saving, add comments or let AI suggest subtasks.
                </p>
              </div>
            )}
          </aside>
        </div>
      </Modal>
      {ai && task && (
        <AiPanel
          type="subtasks"
          project={project}
          task={task}
          onClose={() => setAi(false)}
          onApplied={() => onChange(true)}
        />
      )}
    </>
  );
}
function Comments({
  taskId,
  user,
  canModerate,
  onChange,
}: {
  taskId: string;
  user: User;
  canModerate: boolean;
  onChange: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource<{ comments: Comment[] }>(
    `/tasks/${taskId}/comments?limit=50&offset=${page * 50}`,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/tasks/${taskId}/comments`, { content });
      onChange();
      setContent("");
      setPage(0);
      resource.refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function deleteComment(id: string) {
    if (!window.confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await remove(`/comments/${id}`);
      onChange();
      resource.refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const comments = [...listOf<Comment>(resource.data, "comments")].reverse();
  return (
    <div className={styles["comments"]}>
      <h3 className={styles["native-h3"]}>
        <Icon name="chat" size={17} />
        Conversation <span className={styles["count"]}>{comments.length}</span>
      </h3>
      <ErrorBanner error={error || resource.error} />
      {resource.loading && !resource.data ? (
        <Loading label="Loading comments…" />
      ) : comments.length ? (
        <div className={styles["comment-list"]}>
          {comments.map((comment) => (
            <div className={styles["comment"]} key={comment.id}>
              <div className={styles["comment-top"]}>
                <Avatar name={comment.author.name} size="small" />
                <strong>{comment.author.name}</strong>
                {(comment.authorId === user.id || canModerate) && (
                  <button
                    className={cx(
                      styles["native-button"],
                      styles["icon-button"],
                    )}
                    disabled={busy}
                    aria-label={`Delete comment by ${comment.author.name}`}
                    onClick={() => deleteComment(comment.id)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
              <p className={styles["native-p"]}>{comment.content}</p>
              <small>{timeAgo(comment.createdAt)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p
          className={cx(
            styles["native-p"],
            styles["helper"],
            styles["comments-empty"],
          )}
        >
          Share an update, ask a question, or leave a little context for your
          team.
        </p>
      )}
      <div className={styles["comment-pagination"]}>
        <button
          className={cx(styles["native-button"], styles["text-link"])}
          type="button"
          disabled={resource.loading || comments.length < 50}
          onClick={() => setPage((value) => value + 1)}
        >
          Older
        </button>
        <span>Page {page + 1}</span>
        <button
          className={cx(styles["native-button"], styles["text-link"])}
          type="button"
          disabled={resource.loading || page === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
        >
          Newer
        </button>
      </div>
      <form onSubmit={submit} className={styles["form-stack"]}>
        <label
          className={cx(styles["native-label"], styles["sr-only"])}
          htmlFor="comment"
        >
          Add a comment
        </label>
        <textarea
          className={styles["native-textarea"]}
          id="comment"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment…"
          rows={3}
          maxLength={5000}
          required
        />
        <button
          className={cx(
            styles["native-button"],
            styles["button"],
            styles["secondary"],
          )}
          disabled={busy || !content.trim()}
        >
          {busy ? "Posting…" : "Post comment"}
        </button>
      </form>
    </div>
  );
}
