"use client";
import styles from "./layout.module.css";
import { cx } from "../../lib/class-names";
import Link from "next/link";
import type { Project, User, Workspace } from "../../lib/types";
import { Avatar } from "../ui/avatar";
import { Icon } from "../ui/icon";
import { Loading } from "../ui/loading";
import { Logo } from "../ui/logo";

type AppSidebarProps = {
  user: User;
  pathname: string;
  menu: boolean;
  currentWorkspace?: Workspace;
  workspaceId?: string;
  projectId?: string;
  openingProject: boolean;
  workspaces: Workspace[];
  sidebarProjects: Project[];
  projectsLoading: boolean;
  projectsError?: string;
  onClose: () => void;
  onCreateWorkspace: () => void;
  onWorkspaceChange: (id: string) => void;
  onProjectNavigate: (project: Pick<Project, "id" | "workspaceId">) => void;
  onLogout: () => Promise<void>;
};

export function AppSidebar({
  user,
  pathname,
  menu,
  currentWorkspace,
  workspaceId,
  projectId,
  openingProject,
  workspaces,
  sidebarProjects,
  projectsLoading,
  projectsError,
  onClose,
  onCreateWorkspace,
  onWorkspaceChange,
  onProjectNavigate,
  onLogout,
}: AppSidebarProps) {
  return (
    <aside className={cx(styles["sidebar"], menu ? styles["open"] : undefined)}>
      <div className={styles["sidebar-brand"]}>
        <Link
          className={styles["native-a"]}
          href="/dashboard"
          onClick={() => onClose()}
        >
          <Logo />
        </Link>
        <button
          className={cx(
            styles["native-button"],
            styles["icon-button"],
            styles["mobile-only"],
          )}
          onClick={() => onClose()}
          aria-label="Close navigation"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className={styles["workspace-switch"]}>
        <span className={styles["workspace-avatar"]}>
          {currentWorkspace?.name?.[0]?.toUpperCase() || "W"}
        </span>
        <label
          className={cx(styles["native-label"], styles["sr-only"])}
          htmlFor="workspace-picker"
        >
          Select workspace
        </label>
        <select
          className={styles["native-select"]}
          id="workspace-picker"
          value={workspaceId || ""}
          onChange={(event) => {
            onWorkspaceChange(event.target.value);
            onClose();
          }}
        >
          {!workspaceId && (
            <option value="">
              {openingProject ? "Opening project…" : "Select workspace"}
            </option>
          )}
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Main navigation">
        <Link
          className={cx(
            styles["native-a"],
            styles["nav-item"],
            pathname === "/" || pathname === "/dashboard"
              ? styles["active"]
              : undefined,
          )}
          href="/dashboard"
          onClick={() => onClose()}
        >
          <Icon name="grid" />
          Overview
        </Link>
        {workspaceId && (
          <Link
            className={cx(
              styles["native-a"],
              styles["nav-item"],
              pathname.startsWith("/workspaces/")
                ? styles["active"]
                : undefined,
            )}
            href={`/workspaces/${workspaceId}`}
            onClick={() => onClose()}
          >
            <Icon name="users" />
            Workspace
          </Link>
        )}
        <div className={styles["nav-section"]}>
          <span>YOUR PROJECTS</span>
          <Link
            className={cx(styles["native-a"], styles["icon-button"])}
            title="Manage projects"
            aria-label="Manage projects"
            href={workspaceId ? `/workspaces/${workspaceId}` : "/dashboard"}
          >
            <Icon name="plus" size={16} />
          </Link>
        </div>
        {projectsLoading || openingProject ? (
          <Loading
            label="Loading projects…"
            className={styles["sidebar-loading"]}
          />
        ) : sidebarProjects.length ? (
          sidebarProjects.map((project) => (
            <Link
              className={cx(
                styles["native-a"],
                styles["nav-item"],
                styles["project-nav"],
                pathname === `/projects/${project.id}`
                  ? styles["active"]
                  : undefined,
              )}
              key={project.id}
              href={`/projects/${project.id}`}
              onNavigate={() => onProjectNavigate(project)}
              onClick={() => onClose()}
            >
              <span
                className={styles["project-dot"]}
                style={{ background: project.color }}
              />
              <span>{project.name}</span>
            </Link>
          ))
        ) : (
          <p className={cx(styles["native-p"], styles["sidebar-empty"])}>
            {projectsError ||
              (projectId && !workspaceId
                ? "Select a workspace to browse your projects."
                : "Your projects will live here.")}
          </p>
        )}
        <button
          className={cx(
            styles["native-button"],
            styles["nav-item"],
            styles["create-workspace"],
          )}
          onClick={() => onCreateWorkspace()}
        >
          <Icon name="plus" />
          Create workspace
        </button>
      </nav>
      <div className={styles["sidebar-bottom"]}>
        <div className={styles["sidebar-tip"]}>
          <span className={styles["tip-icon"]}>
            <Icon name="sparkle" size={19} />
          </span>
          <strong>Make room for what matters.</strong>
          <p className={styles["native-p"]}>
            Let AI help plan the next step.
            <br />
            You decide where to go.
          </p>
        </div>
        <div className={styles["user-menu"]}>
          <Avatar name={user.name} />
          <div>
            <strong>{user.name}</strong>
            <small>Your personal account</small>
          </div>
          <button
            className={cx(styles["native-button"], styles["icon-button"])}
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
