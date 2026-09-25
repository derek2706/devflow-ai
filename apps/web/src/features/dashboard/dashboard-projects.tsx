"use client";
import styles from "./dashboard.module.css";
import Link from "next/link";
import { cx } from "../../lib/class-names";
import type { Project } from "../../lib/types";
import { Empty } from "../../components/ui/empty";
import { Icon } from "../../components/ui/icon";
import { ProjectCard } from "../projects/project-card";
export function DashboardProjects({
  projects,
  workspaceId,
  hasWorkspaces,
  onCreate,
  onProjectNavigate,
}: {
  projects: Project[];
  workspaceId?: string;
  hasWorkspaces: boolean;
  onCreate: () => void;
  onProjectNavigate: (project: Pick<Project, "id" | "workspaceId">) => void;
}) {
  return (
    <section className={styles["section"]}>
      <div className={styles["section-heading"]}>
        <div>
          <h2 className={styles["native-h2"]}>
            Your projects{" "}
            <span className={styles["count"]}>{projects.length}</span>
          </h2>
          <p className={styles["native-p"]}>A clear path from idea to done.</p>
        </div>
        {workspaceId && (
          <Link
            className={cx(styles["native-a"], styles["text-link"])}
            href={`/workspaces/${workspaceId}`}
          >
            View all <Icon name="arrow" size={15} />
          </Link>
        )}
      </div>
      {projects.length ? (
        <div className={styles["projects-grid"]}>
          {projects.slice(0, 3).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onNavigate={onProjectNavigate}
            />
          ))}
          <button
            className={cx(styles["native-button"], styles["new-project-card"])}
            onClick={() => onCreate()}
          >
            <span>
              <Icon name="plus" size={24} />
            </span>
            <strong>Create a project</strong>
            <small>Big ideas start here</small>
          </button>
        </div>
      ) : (
        <div className={styles["panel"]}>
          <Empty
            title={
              hasWorkspaces
                ? "Your next project starts here"
                : "First, make yourself at home"
            }
            description={
              hasWorkspaces
                ? "Create a project, add a few tasks, and give your team a clear next step."
                : "Create your first workspace to bring your projects and people together."
            }
          >
            <button
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["primary"],
              )}
              onClick={() => onCreate()}
            >
              <Icon name="plus" size={17} />
              {workspaceId ? "Create project" : "Create workspace"}
            </button>
          </Empty>
        </div>
      )}
    </section>
  );
}
