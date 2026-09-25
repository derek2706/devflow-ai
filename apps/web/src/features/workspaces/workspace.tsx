"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, itemOf, listOf, patch, remove } from "../../lib/api";
import type { Member, Project, Role, User, Workspace } from "../../lib/types";
import { ContentSkeleton } from "../../components/ui/content-skeleton";
import { ErrorBanner } from "../../components/ui/feedback";
import { useResource } from "../../hooks/use-resource";
import { ProjectEditor } from "../projects/project-editor";
import { WorkspaceEditor } from "./workspace-editor";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceTabs, type WorkspaceTab } from "./workspace-tabs";
import { WorkspaceProjects } from "./workspace-projects";
import { WorkspaceMembers } from "./workspace-members";
import { WorkspaceSettings } from "./workspace-settings";
import { InviteEditor } from "./invite-editor";

export interface WorkspaceViewProps {
  id: string;
  user: User;
  onChange: () => void;
  projectsResource: ReturnType<typeof useResource<{ projects: Project[] }>>;
  onProjectNavigate: (project: Pick<Project, "id" | "workspaceId">) => void;
}

export function WorkspaceView({
  id,
  user,
  onChange,
  projectsResource,
  onProjectNavigate,
}: WorkspaceViewProps) {
  const router = useRouter();
  const resource = useResource<{ workspace: Workspace }>(`/workspaces/${id}`);
  const workspace = resource.data
    ? itemOf<Workspace>(resource.data, "workspace")
    : undefined;
  const projects = listOf<Project>(projectsResource.data, "projects");
  const [tab, setTab] = useState<WorkspaceTab>("projects");
  const [settings, setSettings] = useState(false);
  const [createProject, setCreateProject] = useState(false);
  const [invite, setInvite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const ownRole =
    workspace?.role ||
    workspace?.members?.find((member) => member.userId === user.id)?.role;
  const canManage = ownRole === "OWNER" || ownRole === "ADMIN";

  async function memberAction(member: Member, role?: Exclude<Role, "OWNER">) {
    if (
      !role &&
      !window.confirm(
        `Remove ${member.user.name} from this workspace? They will lose access to its projects.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (role)
        await patch(`/workspaces/${id}/members/${member.userId}`, { role });
      else await remove(`/workspaces/${id}/members/${member.userId}`);
      resource.refresh();
      onChange();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkspace() {
    if (
      !window.confirm(
        `Delete “${workspace?.name}” and all its projects, tasks, and comments? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await remove(`/workspaces/${id}`);
      onChange();
      router.push("/dashboard");
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }

  function handleProjectSaved(project: Project) {
    setCreateProject(false);
    onChange();
    onProjectNavigate(project);
    router.push(`/projects/${project.id}`);
  }

  if (!workspace) {
    return (
      <>
        <ErrorBanner error={resource.error} />
        {resource.loading && <ContentSkeleton />}
      </>
    );
  }

  return (
    <>
      <WorkspaceHeader
        workspace={workspace}
        canManage={canManage}
        onInvite={() => setInvite(true)}
        onCreateProject={() => setCreateProject(true)}
      />
      <WorkspaceTabs
        tab={tab}
        projectCount={projects.length}
        memberCount={workspace.members?.length || workspace.memberCount || 0}
        canManage={canManage}
        onTabChange={setTab}
      />
      <ErrorBanner error={error || projectsResource.error} />
      {tab === "projects" && (
        <WorkspaceProjects
          projects={projects}
          loading={projectsResource.loading && !projectsResource.data}
          search={search}
          onSearchChange={setSearch}
          onCreateProject={() => setCreateProject(true)}
          onProjectNavigate={onProjectNavigate}
        />
      )}
      {tab === "members" && (
        <WorkspaceMembers
          members={workspace.members ?? []}
          currentUserId={user.id}
          canManage={canManage}
          busy={busy}
          onRoleChange={memberAction}
          onRemove={memberAction}
        />
      )}
      {tab === "settings" && canManage && (
        <WorkspaceSettings
          canDelete={ownRole === "OWNER"}
          busy={busy}
          onEdit={() => setSettings(true)}
          onDelete={deleteWorkspace}
        />
      )}
      {settings && (
        <WorkspaceEditor
          workspace={workspace}
          onClose={() => setSettings(false)}
          onSave={() => {
            setSettings(false);
            resource.refresh();
            onChange();
          }}
        />
      )}
      {createProject && (
        <ProjectEditor
          workspaceId={id}
          onClose={() => setCreateProject(false)}
          onSave={handleProjectSaved}
        />
      )}
      {invite && (
        <InviteEditor workspaceId={id} onClose={() => setInvite(false)} />
      )}
    </>
  );
}
