"use client";
import styles from "./task.module.css";
import { cx } from "../../lib/class-names";
import type { FormEventHandler } from "react";
import type { Project, Task } from "../../lib/types";
import { ErrorBanner } from "../../components/ui/feedback";
import { Icon } from "../../components/ui/icon";

export interface TaskFormProps {
  project: Project;
  task?: Task;
  columnId?: string;
  error: string;
  busy: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDelete: () => void;
  onCancel: () => void;
}

export function TaskForm({
  project,
  task,
  columnId,
  error,
  busy,
  onSubmit,
  onDelete,
  onCancel,
}: TaskFormProps) {
  return (
    <form className={styles["form-stack"]} onSubmit={onSubmit}>
      <ErrorBanner error={error} />
      <label className={styles["native-label"]}>
        Task title
        <input
          name="title"
          defaultValue={task?.title}
          placeholder="What needs to happen?"
          className={cx(styles["native-input"], styles["task-title-input"])}
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
            defaultValue={task?.columnId || columnId || project.columns[0]?.id}
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
          Separate labels with commas. Up to 20 labels, 32 characters each.
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
            onClick={onDelete}
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
          onClick={onCancel}
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
  );
}
