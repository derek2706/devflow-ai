"use client";
import styles from "./project.module.css";
import { cx } from "../../lib/class-names";
import type { Project } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { Icon } from "../../components/ui/icon";

export interface ProjectHeaderProps {
  project: Project;
  workspaceName?: string;
  canManage: boolean;
  onMembers: () => void;
  onSettings: () => void;
  onCreateTask: () => void;
}

export function ProjectHeader({
  project,
  workspaceName,
  canManage,
  onMembers,
  onSettings,
  onCreateTask,
}: ProjectHeaderProps) {
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
              {workspaceName || "YOUR PROJECT"}
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
            onClick={onMembers}
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
              onClick={onSettings}
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
            onClick={onCreateTask}
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
    </>
  );
}
