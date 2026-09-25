"use client";
import styles from "./project.module.css";
import { cx } from "../../lib/class-names";
import type { Column, Task } from "../../lib/types";
import { Icon } from "../../components/ui/icon";
import { TaskCard } from "./task-card";

export interface BoardColumnProps {
  column: Column;
  index: number;
  visible: Task[];
  canManage: boolean;
  moving: boolean;
  dragOver: boolean;
  onDragEnterColumn: () => void;
  onDragLeaveColumn: () => void;
  onMoveTask: (taskId: string, position: number) => void;
  onEdit: () => void;
  onCreateTask: () => void;
  onOpenTask: (task: Task) => void;
}

export function BoardColumn({
  column,
  index,
  visible,
  canManage,
  moving,
  dragOver,
  onDragEnterColumn,
  onDragLeaveColumn,
  onMoveTask,
  onEdit,
  onCreateTask,
  onOpenTask,
}: BoardColumnProps) {
  return (
    <section
      className={cx(
        styles["kanban-column"],
        dragOver ? styles["drag-over"] : undefined,
      )}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragEnterColumn();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          onDragLeaveColumn();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onMoveTask(
          event.dataTransfer.getData("text/task-id"),
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
            className={cx(styles["native-button"], styles["icon-button"])}
            aria-label={`Edit ${column.name} column`}
            onClick={onEdit}
          >
            <Icon name="edit" size={14} />
          </button>
        )}
        <button
          className={cx(styles["native-button"], styles["icon-button"])}
          aria-label={`Add task to ${column.name}`}
          onClick={onCreateTask}
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
            onOpen={() => onOpenTask(task)}
            disabled={moving}
            onDrop={(taskId) => onMoveTask(taskId, task.position)}
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
        className={cx(styles["native-button"], styles["add-task-button"])}
        onClick={onCreateTask}
      >
        <Icon name="plus" size={16} />
        Add task
      </button>
    </section>
  );
}
