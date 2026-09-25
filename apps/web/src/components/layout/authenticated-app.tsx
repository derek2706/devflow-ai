"use client";
import styles from "./layout.module.css";
import { cx } from "../../lib/class-names";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listOf } from "../../lib/api";
import { Project, User, Workspace } from "../../lib/types";
import { ContentSkeleton } from "../ui/content-skeleton";
import { Empty } from "../ui/empty";
import { ErrorBanner } from "../ui/feedback";
import { useResource } from "../../hooks/use-resource";
import { WorkspaceEditor } from "../../features/workspaces/workspace-editor";
import { Dashboard } from "../../features/dashboard/dashboard";
import { WorkspaceView } from "../../features/workspaces/workspace";
import { ProjectView } from "../../features/projects/project-view";

import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { Invite } from "../../features/invitations/accept-invitation";

export function AuthenticatedApp({
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
      <AppSidebar
        user={user}
        pathname={pathname}
        menu={menu}
        currentWorkspace={currentWorkspace}
        workspaceId={workspaceId}
        projectId={projectId}
        openingProject={openingProject}
        workspaces={workspaces}
        sidebarProjects={sidebarProjects}
        projectsLoading={projectResource.loading && !projectResource.data}
        projectsError={projectResource.error}
        onClose={() => setMenu(false)}
        onCreateWorkspace={() => setCreating(true)}
        onWorkspaceChange={(id) => {
          setActiveWorkspace(id);
          router.push(`/workspaces/${id}`);
        }}
        onProjectNavigate={rememberProject}
        onLogout={onLogout}
      />
      <div className={styles["main-wrap"]}>
        <AppHeader
          pathname={pathname}
          currentWorkspace={currentWorkspace}
          user={user}
          onOpenNavigation={() => setMenu(true)}
        />
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
