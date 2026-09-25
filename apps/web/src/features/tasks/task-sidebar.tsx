"use client";
import styles from "./task.module.css";
import { cx } from "../../lib/class-names";
import type { Task, User } from "../../lib/types";
import { Icon } from "../../components/ui/icon";
import { TaskComments } from "./task-comments";

export interface TaskSidebarProps {
  task?: Task;
  user: User;
  canModerate: boolean;
  onGenerate: () => void;
  onCommentsChange: () => void;
}

export function TaskSidebar({
  task,
  user,
  canModerate,
  onGenerate,
  onCommentsChange,
}: TaskSidebarProps) {
  return (
    <aside className={styles["task-detail-aside"]}>
      {task ? (
        <>
          <div className={styles["task-ai-card"]}>
            <span className={cx(styles["ai-orb"], styles["small"])}>
              <Icon name="sparkle" size={22} />
            </span>
            <h3 className={styles["native-h3"]}>Big task? Small steps.</h3>
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
              onClick={onGenerate}
            >
              <Icon name="sparkle" size={16} />
              Generate subtasks
            </button>
            <small>Uses the last saved task details.</small>
          </div>
          <TaskComments
            taskId={task.id}
            user={user}
            canModerate={canModerate}
            onChange={onCommentsChange}
          />
        </>
      ) : (
        <div className={styles["task-ai-card"]}>
          <Icon name="board" size={28} />
          <h3 className={styles["native-h3"]}>Clarity creates momentum.</h3>
          <p className={styles["native-p"]}>
            A clear title and a little context help everyone take the next step.
          </p>
          <p className={styles["native-p"]}>
            After saving, add comments or let AI suggest subtasks.
          </p>
        </div>
      )}
    </aside>
  );
}
