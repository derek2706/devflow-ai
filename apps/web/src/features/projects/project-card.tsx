"use client";
import Link from "next/link";
import type { Project } from "../../lib/types";
import { cx } from "../../lib/class-names";
import { Icon } from "../../components/ui/icon";
import styles from "./project-card.module.css";
export function ProjectCard({
  project,
  className,
  onNavigate,
}: {
  project: Project;
  className?: string;
  onNavigate?: (project: Pick<Project, "id" | "workspaceId">) => void;
}) {
  const tasks = project.columns?.flatMap((column) => column.tasks || []) || [];
  const total = project._count?.tasks ?? tasks.length;
  const completed =
    project.columns
      ?.filter((column) => column.isDone)
      .reduce((sum, column) => sum + (column.tasks?.length || 0), 0) || 0;
  return (
    <Link
      href={`/projects/${project.id}`}
      onNavigate={() => onNavigate?.(project)}
      className={cx(styles["native-a"], styles["project-card"], className)}
    >
      <div className={styles["project-card-top"]}>
        <span
          className={styles["project-icon"]}
          style={{ color: project.color, background: `${project.color}18` }}
        >
          <Icon name="folder" size={21} />
        </span>
        <Icon name="arrow" size={17} />
      </div>
      <h3 className={styles["native-h3"]}>{project.name}</h3>
      <p className={styles["native-p"]}>
        {project.description || "A space to turn ideas into progress."}
      </p>
      <div className={styles["project-card-meta"]}>
        <span>
          <Icon name="board" size={14} />
          {total} {total === 1 ? "task" : "tasks"}
        </span>
        <span>
          <Icon name="users" size={14} />
          {project._count?.members ?? project.members?.length ?? 0}
        </span>
      </div>
      {project.columns && (
        <div
          className={styles["project-progress"]}
          aria-label={`${completed} of ${total} tasks complete`}
        >
          <span
            style={{
              width: `${total ? (completed / total) * 100 : 0}%`,
              backgroundColor: project.color,
            }}
          />
        </div>
      )}
    </Link>
  );
}
