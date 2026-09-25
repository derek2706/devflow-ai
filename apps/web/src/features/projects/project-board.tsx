"use client";
import styles from "./project.module.css";
import { cx } from "../../lib/class-names";
import type { Column, Project, Task, User } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { ErrorBanner } from "../../components/ui/feedback";
import { Icon } from "../../components/ui/icon";
import { BoardColumn } from "./board-column";

export type ProjectAiAction = "project-summary" | "sprint-plan";

export interface BoardFilters {
  search: string;
  priority: string;
  mine: boolean;
}

export interface ProjectBoardProps {
  project: Project;
  filters: BoardFilters;
  onFiltersChange: (changes: Partial<BoardFilters>) => void;
  user: User;
  canManage: boolean;
  error?: string;
  moving: boolean;
  dragOver: string;
  onDragOver: (columnId: string) => void;
  onMoveTask: (
    taskId: string,
    columnId: string,
    position: number,
  ) => Promise<void>;
  onEditColumn: (column: Column) => void;
  onCreateColumn: () => void;
  onCreateTask: (columnId?: string) => void;
  onOpenTask: (task: Task) => void;
  onGenerateAi: (action: ProjectAiAction) => void;
}

export function ProjectBoard({
  project,
  filters,
  onFiltersChange,
  user,
  canManage,
  error,
  moving,
  dragOver,
  onDragOver,
  onMoveTask,
  onEditColumn,
  onCreateColumn,
  onCreateTask,
  onOpenTask,
  onGenerateAi,
}: ProjectBoardProps) {
  const { search, priority, mine } = filters;
  return (
    <>
      <div className={styles["board-toolbar"]}>
        <div className={styles["board-filters"]}>
          <label className={cx(styles["native-label"], styles["search-field"])}>
            <Icon name="search" size={17} />
            <input
              className={styles["native-input"]}
              placeholder="Search tasks…"
              value={search}
              onChange={(event) =>
                onFiltersChange({ search: event.target.value })
              }
              aria-label="Search tasks"
            />
          </label>
          <select
            className={styles["native-select"]}
            value={priority}
            onChange={(event) =>
              onFiltersChange({ priority: event.target.value })
            }
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
            onClick={() => onFiltersChange({ mine: !mine })}
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
            onClick={() => onGenerateAi("project-summary")}
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
            onClick={() => onGenerateAi("sprint-plan")}
          >
            Plan a sprint
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </div>
      <ErrorBanner error={error} />
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
              <BoardColumn
                key={column.id}
                column={column}
                index={index}
                visible={visible}
                canManage={canManage}
                moving={moving}
                dragOver={dragOver === column.id}
                onDragEnterColumn={() => onDragOver(column.id)}
                onDragLeaveColumn={() => onDragOver("")}
                onMoveTask={(taskId, position) => {
                  void onMoveTask(taskId, column.id, position);
                }}
                onEdit={() => onEditColumn(column)}
                onCreateTask={() => onCreateTask(column.id)}
                onOpenTask={onOpenTask}
              />
            );
          })}
        {canManage && (
          <button
            className={cx(styles["native-button"], styles["add-column"])}
            onClick={onCreateColumn}
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
    </>
  );
}
