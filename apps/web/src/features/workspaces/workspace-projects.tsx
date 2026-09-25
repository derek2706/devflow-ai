"use client";
import styles from "./workspace.module.css";
import { cx } from "../../lib/class-names";
import type { Project } from "../../lib/types";
import { ContentSkeleton } from "../../components/ui/content-skeleton";
import { Empty } from "../../components/ui/empty";
import { Icon } from "../../components/ui/icon";
import { ProjectCard } from "../projects/project-card";
export function WorkspaceProjects({
  projects,
  loading,
  search,
  onSearchChange,
  onCreateProject,
  onProjectNavigate,
}: {
  projects: Project[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreateProject: () => void;
  onProjectNavigate: (project: Pick<Project, "id" | "workspaceId">) => void;
}) {
  return (
    <>
      <div className={styles["section-heading"]}>
        <h2 className={styles["native-h2"]}>All projects</h2>
        <label className={cx(styles["native-label"], styles["search-field"])}>
          <Icon name="search" size={17} />
          <input
            className={styles["native-input"]}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Find a project…"
            aria-label="Search projects"
          />
        </label>
      </div>
      {loading ? (
        <ContentSkeleton label="Loading projects…" heading={false} />
      ) : projects.length ? (
        <div
          className={cx(styles["projects-grid"], styles["workspace-projects"])}
        >
          {projects
            .filter((project) =>
              project.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                className={styles.workspaceProjectCard}
                onNavigate={onProjectNavigate}
              />
            ))}
          {!search && (
            <button
              className={cx(
                styles["native-button"],
                styles["new-project-card"],
              )}
              onClick={() => onCreateProject()}
            >
              <span>
                <Icon name="plus" size={24} />
              </span>
              <strong>Create a project</strong>
              <small>Give your next idea a home</small>
            </button>
          )}
          {search &&
            !projects.some((project) =>
              project.name.toLowerCase().includes(search.toLowerCase()),
            ) && (
              <Empty
                icon="search"
                title="No projects found"
                description="Try a different name."
              />
            )}
        </div>
      ) : (
        <div className={styles["panel"]}>
          <Empty
            title="Room for your next big idea"
            description="Create a project to start planning your team's work."
          >
            <button
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["primary"],
              )}
              onClick={() => onCreateProject()}
            >
              Create your first project
            </button>
          </Empty>
        </div>
      )}
    </>
  );
}
