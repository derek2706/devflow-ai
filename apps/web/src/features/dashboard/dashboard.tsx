"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DashboardData, Project, User, Workspace } from "../../lib/types";
import { ContentSkeleton } from "../../components/ui/content-skeleton";
import { ErrorBanner } from "../../components/ui/feedback";
import { useResource } from "../../hooks/use-resource";
import { AiPanel } from "../ai/ai-panel";
import { ProjectEditor } from "../projects/project-editor";
import { DashboardHeader } from "./dashboard-header";
import { DashboardStats } from "./dashboard-stats";
import { StandupBanner } from "./standup-banner";
import { DashboardProjects } from "./dashboard-projects";
import { RecentTasks } from "./recent-tasks";
import { TeamActivity } from "./team-activity";
import styles from "./dashboard.module.css";

export interface DashboardProps {
  user: User;
  workspace?: Workspace;
  workspaces: Workspace[];
  onCreateWorkspace: () => void;
  onChange: () => void;
  onProjectNavigate: (project: Pick<Project, "id" | "workspaceId">) => void;
}

export function Dashboard({
  user,
  workspace,
  workspaces,
  onCreateWorkspace,
  onChange,
  onProjectNavigate,
}: DashboardProps) {
  const router = useRouter();
  const resource = useResource<DashboardData>(
    `/dashboard${workspace ? `?workspaceId=${workspace.id}` : ""}`,
  );
  const [createProject, setCreateProject] = useState(false);
  const [ai, setAi] = useState(false);
  const data = resource.data;

  function handleCreate() {
    if (workspace) setCreateProject(true);
    else onCreateWorkspace();
  }

  function handleTaskNavigate(projectId: string) {
    const project = data?.projects.find((item) => item.id === projectId);
    if (project) onProjectNavigate(project);
  }

  function handleProjectSaved(project: Project) {
    setCreateProject(false);
    onChange();
    onProjectNavigate(project);
    router.push(`/projects/${project.id}`);
  }

  return (
    <>
      <DashboardHeader
        userName={user.name}
        hasWorkspace={Boolean(workspace)}
        onCreate={handleCreate}
      />
      <ErrorBanner error={resource.error} />
      {resource.loading && !data ? (
        <ContentSkeleton label="Loading your overview…" heading={false} />
      ) : (
        data && (
          <>
            <DashboardStats stats={data.stats} />
            <StandupBanner
              disabled={!workspace}
              onGenerate={() => setAi(true)}
            />
            <DashboardProjects
              projects={data.projects}
              workspaceId={workspace?.id}
              hasWorkspaces={workspaces.length > 0}
              onCreate={handleCreate}
              onProjectNavigate={onProjectNavigate}
            />
            <div className={styles["dashboard-lower"]}>
              <RecentTasks
                tasks={data.recentTasks}
                onTaskNavigate={handleTaskNavigate}
              />
              <TeamActivity activities={data.recentActivity} />
            </div>
          </>
        )
      )}
      {createProject && workspace && (
        <ProjectEditor
          workspaceId={workspace.id}
          onClose={() => setCreateProject(false)}
          onSave={handleProjectSaved}
        />
      )}
      {ai && workspace && (
        <AiPanel
          type="standup"
          workspaceId={workspace.id}
          onClose={() => setAi(false)}
        />
      )}
    </>
  );
}
