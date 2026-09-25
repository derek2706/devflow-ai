"use client";
import styles from "./project.module.css";
import { cx } from "../../lib/class-names";
import type { Task } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { dateLabel } from "../../lib/format-date";
import { Icon } from "../../components/ui/icon";
import { PriorityBadge } from "../../components/ui/priority-badge";

export interface TaskCardProps {
  task: Task;
  complete: boolean;
  onOpen: () => void;
  onDrop: (id: string) => void;
  disabled: boolean;
}

export function TaskCard({
  task,
  complete,
  onOpen,
  onDrop,
  disabled,
}: TaskCardProps) {
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
