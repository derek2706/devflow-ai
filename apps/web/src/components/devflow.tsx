"use client";
import styles from "./devflow.module.css";
import { cx } from "../lib/class-names";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, errorText, listOf, post } from "../lib/api";
import { Project, User, Workspace } from "../lib/types";
import { Auth } from "./auth";
import {
  Avatar,
  ContentSkeleton,
  Empty,
  ErrorBanner,
  Icon,
  Loading,
  Logo,
  SessionExpiredContext,
  useResource,
} from "./ui";
import { WorkspaceEditor } from "./editors";
import { Dashboard } from "./dashboard";
import { WorkspaceView } from "./workspace";
import { ProjectView } from "./project";

export function DevFlow() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);
  const [user, setUser] = useState<User | null>();
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const clearSession = useCallback(() => {
    setUser(null);
    setAuthError("");
  }, []);
  const signIn = useCallback((nextUser: User) => {
    setUser(nextUser);
    setAuthError("");
  }, []);
  useEffect(() => {
    if (isPublic || user !== undefined) return;
    const controller = new AbortController();
    api<{ user: User }>("/auth/me", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setUser(data.user);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        } else setAuthError(errorText(error));
      });
    return () => controller.abort();
  }, [isPublic, user, attempt, clearSession]);
  useEffect(() => {
    if (isPublic || user !== null) return;
    const next =
      pathname === "/invite"
        ? `?next=${encodeURIComponent(pathname + window.location.search)}`
        : "";
    router.replace(`/login${next}`);
  }, [isPublic, user, pathname, router]);
  async function logout() {
    try {
      await post("/auth/logout");
      clearSession();
      router.replace("/login");
    } catch (error) {
      setAuthError(errorText(error));
    }
  }
  if (isPublic || user === null)
    return (
      <Auth
        key={pathname}
        path={isPublic ? pathname : "/login"}
        onLogin={signIn}
      />
    );
  if (user === undefined)
    return (
      <main className={styles["boot"]}>
        <Logo />
        {authError ? (
          <>
            <ErrorBanner error={authError} className={styles["bootNotice"]} />
            <button
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["primary"],
              )}
              onClick={() => {
                setAuthError("");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <Loading
            label="Getting things ready…"
            className={styles["bootLoading"]}
          />
        )}
      </main>
    );
  return (
    <SessionExpiredContext.Provider value={clearSession}>
      <AuthenticatedApp
        key={user.id}
        user={user}
        authError={authError}
        onLogout={logout}
      />
    </SessionExpiredContext.Provider>
  );
}

function AuthenticatedApp({
  user,
  authError,
  onLogout,
}: {
  user: User;
  authError: string;
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const main = useRef<HTMLElement>(null);
  const [previousPath, setPreviousPath] = useState(pathname);
  const [activeWorkspace, setActiveWorkspace] = useState(() =>
    pathname.startsWith("/workspaces/") ? pathname.split("/")[2] : "",
  );
  const [projectLocation, setProjectLocation] =
    useState<Pick<Project, "id" | "workspaceId">>();
  const [menu, setMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const workspacesResource = useResource<{ workspaces: Workspace[] }>(
    "/workspaces",
  );
  const workspaces = listOf<Workspace>(workspacesResource.data, "workspaces");
  const projectId = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : undefined;
  const routedWorkspaceId = pathname.startsWith("/workspaces/")
    ? pathname.split("/")[2]
    : undefined;
  // Remember the route's workspace and close navigation/dialogs before painting
  // a new page. This avoids an effect-driven render with the previous selection.
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    if (routedWorkspaceId) setActiveWorkspace(routedWorkspaceId);
    setMenu(false);
    setCreating(false);
  }
  const workspaceId =
    routedWorkspaceId ||
    (projectId
      ? projectLocation?.id === projectId
        ? projectLocation.workspaceId
        : undefined
      : workspaces.find((workspace) => workspace.id === activeWorkspace)?.id ||
        workspaces[0]?.id);
  const openingProject = !!projectId && projectLocation?.id !== projectId;
  const currentWorkspace = workspaces.find(
    (workspace) => workspace.id === workspaceId,
  );
  const projectResource = useResource<{ projects: Project[] }>(
    workspaceId ? `/workspaces/${workspaceId}/projects` : null,
  );
  const sidebarProjects = listOf<Project>(projectResource.data, "projects");
  const rememberProject = useCallback(
    (project: Pick<Project, "id" | "workspaceId">) => {
      setProjectLocation((previous) =>
        previous?.id === project.id &&
        previous.workspaceId === project.workspaceId
          ? previous
          : { id: project.id, workspaceId: project.workspaceId },
      );
      setActiveWorkspace(project.workspaceId);
    },
    [],
  );
  const resolveProjectWorkspace = useCallback(
    (id: string | null) => {
      if (!projectId) return;
      if (id) rememberProject({ id: projectId, workspaceId: id });
      else
        setProjectLocation((previous) =>
          previous?.id === projectId
            ? previous
            : { id: projectId, workspaceId: "" },
        );
    },
    [projectId, rememberProject],
  );
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, [pathname]);
  function refresh() {
    workspacesResource.refresh();
    projectResource.refresh();
  }
  return (
    <div className={styles["app-shell"]}>
      <a className={cx(styles["native-a"], styles["skip-link"])} href="#main">
        Skip to content
      </a>
      {menu && (
        <div
          className={styles["sidebar-scrim"]}
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={cx(styles["sidebar"], menu ? styles["open"] : undefined)}
      >
        <div className={styles["sidebar-brand"]}>
          <Link
            className={styles["native-a"]}
            href="/dashboard"
            onClick={() => setMenu(false)}
          >
            <Logo />
          </Link>
          <button
            className={cx(
              styles["native-button"],
              styles["icon-button"],
              styles["mobile-only"],
            )}
            onClick={() => setMenu(false)}
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
              setActiveWorkspace(event.target.value);
              router.push(`/workspaces/${event.target.value}`);
              setMenu(false);
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
            onClick={() => setMenu(false)}
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
              onClick={() => setMenu(false)}
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
          {(projectResource.loading && !projectResource.data) ||
          openingProject ? (
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
                onNavigate={() => rememberProject(project)}
                onClick={() => setMenu(false)}
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
              {projectResource.error ||
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
            onClick={() => setCreating(true)}
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
      <div className={styles["main-wrap"]}>
        <header className={styles["topbar"]}>
          <div className={styles["breadcrumb"]}>
            <button
              className={cx(
                styles["native-button"],
                styles["icon-button"],
                styles["mobile-only"],
              )}
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <Icon name="folder" size={17} />
            <span>{currentWorkspace?.name || "Your workspace"}</span>
            <span className={styles["slash"]}>/</span>
            <strong>
              {pathname.startsWith("/projects/")
                ? "Project board"
                : pathname.startsWith("/workspaces/")
                  ? "Workspace"
                  : pathname === "/invite"
                    ? "Invitation"
                    : "Overview"}
            </strong>
          </div>
          <span className={styles["topbar-caption"]}>
            <span className={styles["live-dot"]} />A little more flow, every
            day.
          </span>
          <Avatar
            name={user.name}
            size="small"
            className={styles["topbarAvatar"]}
          />
        </header>
        <main
          id="main"
          ref={main}
          tabIndex={-1}
          className={styles["main-content"]}
        >
          <ErrorBanner error={authError || workspacesResource.error} />
          {pathname === "/" || pathname === "/dashboard" ? (
            workspacesResource.loading && !workspacesResource.data ? (
              <ContentSkeleton label="Loading your overview…" />
            ) : (
              <Dashboard
                key={workspaceId || "all"}
                user={user}
                workspace={currentWorkspace}
                workspaces={workspaces}
                onCreateWorkspace={() => setCreating(true)}
                onChange={refresh}
                onProjectNavigate={rememberProject}
              />
            )
          ) : pathname.startsWith("/workspaces/") ? (
            <WorkspaceView
              key={workspaceId}
              id={routedWorkspaceId!}
              user={user}
              onChange={refresh}
              projectsResource={projectResource}
              onProjectNavigate={rememberProject}
            />
          ) : pathname.startsWith("/projects/") ? (
            <ProjectView
              key={pathname}
              id={pathname.split("/")[2]}
              user={user}
              workspaces={workspaces}
              onWorkspace={resolveProjectWorkspace}
              onChange={refresh}
              onProjectsChange={projectResource.refresh}
            />
          ) : pathname === "/invite" ? (
            <Invite onJoined={refresh} />
          ) : (
            <Empty
              title="Page not found"
              description="Let's get you back to your workspace."
            >
              <Link
                href="/dashboard"
                className={cx(
                  styles["native-a"],
                  styles["button"],
                  styles["primary"],
                )}
              >
                Go to overview
              </Link>
            </Empty>
          )}
        </main>
      </div>
      {creating && (
        <WorkspaceEditor
          onClose={() => setCreating(false)}
          onSave={(workspace) => {
            setCreating(false);
            setActiveWorkspace(workspace.id);
            refresh();
            router.push(`/workspaces/${workspace.id}`);
          }}
        />
      )}
    </div>
  );
}
function Invite({ onJoined }: { onJoined: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token)
        throw new Error(
          "This invitation is missing its token. Ask a workspace admin for a new link.",
        );
      const data = await post<{ workspace: Workspace }>("/invitations/accept", {
        token,
      });
      onJoined();
      router.push(`/workspaces/${data.workspace.id}`);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <div className={cx(styles["invite-panel"], styles["panel"])}>
      <span className={styles["empty-icon"]}>
        <Icon name="users" size={28} />
      </span>
      <span className={styles["eyebrow"]}>BETTER TOGETHER</span>
      <h1 className={styles["native-h1"]}>Your team is waiting</h1>
      <p className={styles["native-p"]}>
        Accept your invitation to join the workspace and start collaborating.
      </p>
      <ErrorBanner error={error} />
      <button
        className={cx(
          styles["native-button"],
          styles["button"],
          styles["primary"],
        )}
        onClick={accept}
        disabled={busy}
      >
        {busy ? "Joining…" : "Accept invitation"}
      </button>
      <Link
        className={cx(styles["native-a"], styles["text-link"])}
        href="/dashboard"
      >
        Back to my workspace
      </Link>
    </div>
  );
}
