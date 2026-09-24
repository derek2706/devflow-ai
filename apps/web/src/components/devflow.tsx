"use client";
import styles from "./devflow.module.css";
import { cx } from "../lib/class-names";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, errorText, listOf, post } from "../lib/api";
import { Project, User, Workspace } from "../lib/types";
import { Auth } from "./auth";
import {
  Avatar,
  Empty,
  ErrorBanner,
  Icon,
  Loading,
  Logo,
  useResource,
} from "./ui";
import { WorkspaceEditor } from "./editors";
import { Dashboard } from "./dashboard";
import { WorkspaceView } from "./workspace";
import { ProjectView } from "./project";

export function DevFlow() {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState("");
  const [menu, setMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const workspacesResource = useResource<{ workspaces: Workspace[] }>(
    user ? "/workspaces" : null,
  );
  const workspaces = listOf<Workspace>(workspacesResource.data, "workspaces");
  const workspaceId = pathname.startsWith("/workspaces/")
    ? pathname.split("/")[2]
    : workspaces.find((workspace) => workspace.id === activeWorkspace)?.id ||
      workspaces[0]?.id;
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const projectResource = useResource<{ projects: Project[] }>(
    user && workspaceId ? `/workspaces/${workspaceId}/projects` : null,
  );
  const sidebarProjects = listOf<Project>(projectResource.data, "projects");
  useEffect(() => {
    if (isPublic || user) return;
    let active = true;
    api<{ user: User }>("/auth/me")
      .then((data) => {
        if (active) {
          setUser(data.user);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          const next =
            pathname === "/invite"
              ? `?next=${encodeURIComponent(pathname + window.location.search)}`
              : "";
          router.replace(`/login${next}`);
        } else setAuthError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [isPublic, user, pathname, router, attempt]);
  async function logout() {
    try {
      await post("/auth/logout");
      setUser(null);
      router.push("/login");
    } catch (error) {
      setAuthError(errorText(error));
    }
  }
  function refresh() {
    workspacesResource.refresh();
    projectResource.refresh();
  }
  if (isPublic)
    return <Auth key={pathname} path={pathname} onLogin={setUser} />;
  if (!user)
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
              onClick={() => setAttempt((value) => value + 1)}
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
            {!workspaces.length && <option value="">Your workspaces</option>}
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
          {sidebarProjects.length ? (
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
              Your projects will live here.
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
              onClick={logout}
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
        <main id="main" className={styles["main-content"]}>
          <ErrorBanner error={authError || workspacesResource.error} />
          {pathname === "/" || pathname === "/dashboard" ? (
            <Dashboard
              user={user}
              workspace={currentWorkspace}
              workspaces={workspaces}
              onCreateWorkspace={() => setCreating(true)}
              onChange={refresh}
            />
          ) : pathname.startsWith("/workspaces/") ? (
            <WorkspaceView
              key={workspaceId}
              id={workspaceId}
              user={user}
              onChange={refresh}
            />
          ) : pathname.startsWith("/projects/") ? (
            <ProjectView
              key={pathname}
              id={pathname.split("/")[2]}
              user={user}
              workspaces={workspaces}
              onWorkspace={setActiveWorkspace}
              onChange={refresh}
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
