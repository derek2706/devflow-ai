"use client";
import styles from "./project.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { errorText, itemOf, patch, remove } from "../../lib/api";
import type { Column, Project, Task, User, Workspace } from "../../lib/types";
import { ContentSkeleton } from "../../components/ui/content-skeleton";
import { ErrorBanner } from "../../components/ui/feedback";
import { useResource } from "../../hooks/use-resource";
import { AiPanel } from "../ai/ai-panel";
import { TaskEditor } from "../tasks/task-editor";
import { ProjectHeader } from "./project-header";
import { ProjectBoard, type BoardFilters } from "./project-board";
import { ProjectEditor } from "./project-editor";
import { ColumnEditor } from "./column-editor";
import { ProjectMembers } from "./project-members";

export interface ProjectViewProps {
  id: string;
  user: User;
  workspaces: Workspace[];
  onWorkspace: (id: string | null) => void;
  onChange: () => void;
  onProjectsChange: () => void;
}

export function ProjectView({
  id,
  user,
  workspaces,
  onWorkspace,
  onChange,
  onProjectsChange,
}: ProjectViewProps) {
  const router = useRouter();
  const resource = useResource<{ project: Project }>(`/projects/${id}`);
  const project = resource.data
    ? itemOf<Project>(resource.data, "project")
    : undefined;
  const [filters, setFilters] = useState<BoardFilters>({
    search: "",
    priority: "",
    mine: false,
  });
  const [settings, setSettings] = useState(false);
  const [members, setMembers] = useState(false);
  const [columnEditor, setColumnEditor] = useState<Column | "new" | null>(null);
  const [taskEditor, setTaskEditor] = useState<{
    task?: Task;
    columnId?: string;
  } | null>(null);
  const [ai, setAi] = useState<"project-summary" | "sprint-plan" | null>(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [dragOver, setDragOver] = useState("");
  const workspace = workspaces.find((w) => w.id === project?.workspaceId);
  const canManage =
    workspace?.role === "OWNER" ||
    workspace?.role === "ADMIN" ||
    project?.createdById === user.id;
  useEffect(() => {
    if (project?.workspaceId) onWorkspace(project.workspaceId);
    else if (resource.error) onWorkspace(null);
  }, [project?.workspaceId, resource.error, onWorkspace]);
  useEffect(() => {
    if (!project) return;
    const taskId = new URLSearchParams(window.location.search).get("task");
    const task = project.columns
      ?.flatMap((column) => column.tasks)
      .find((task) => task.id === taskId);
    if (task) queueMicrotask(() => setTaskEditor({ task }));
  }, [project]);
  function refresh(projectSummaryChanged = false) {
    resource.refresh();
    if (projectSummaryChanged) onProjectsChange();
  }
  async function moveTask(taskId: string, columnId: string, position: number) {
    if (
      !project?.columns.some((column) =>
        column.tasks.some((task) => task.id === taskId),
      )
    )
      return;
    setMoving(true);
    setError("");
    setDragOver("");
    try {
      await patch(`/tasks/${taskId}/move`, { columnId, position });
      resource.refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setMoving(false);
    }
  }
  async function deleteProject() {
    if (
      !window.confirm(
        `Delete “${project?.name}” and all its tasks? This cannot be undone.`,
      )
    )
      return;
    try {
      await remove(`/projects/${id}`);
      onChange();
      router.push(`/workspaces/${project?.workspaceId}`);
    } catch (error) {
      setError(errorText(error));
    }
  }
  if (!project)
    return (
      <>
        <ErrorBanner error={resource.error} />
        {resource.loading && <ContentSkeleton label="Opening your project…" />}
      </>
    );
  return (
    <>
      <ProjectHeader
        project={project}
        workspaceName={workspace?.name}
        canManage={canManage}
        onMembers={() => setMembers(true)}
        onSettings={() => setSettings(true)}
        onCreateTask={() => setTaskEditor({ columnId: project.columns[0]?.id })}
      />
      <ProjectBoard
        project={project}
        filters={filters}
        onFiltersChange={(changes) =>
          setFilters((current) => ({ ...current, ...changes }))
        }
        user={user}
        canManage={canManage}
        error={error || resource.error}
        moving={moving}
        dragOver={dragOver}
        onDragOver={setDragOver}
        onMoveTask={moveTask}
        onEditColumn={setColumnEditor}
        onCreateColumn={() => setColumnEditor("new")}
        onCreateTask={(columnId) => setTaskEditor({ columnId })}
        onOpenTask={(task) => setTaskEditor({ task })}
        onGenerateAi={setAi}
      />
      {settings && (
        <>
          <ProjectEditor
            project={project}
            workspaceId={project.workspaceId}
            onClose={() => setSettings(false)}
            onSave={() => {
              setSettings(false);
              refresh(true);
            }}
          />
        </>
      )}
      {canManage && (
        <div className={styles["project-danger-link"]}>
          <button className={styles["native-button"]} onClick={deleteProject}>
            Delete project
          </button>
        </div>
      )}
      {members && (
        <ProjectMembers
          project={project}
          canManage={canManage}
          onClose={() => setMembers(false)}
          onChange={() => refresh(true)}
        />
      )}
      {canManage && columnEditor && (
        <ColumnEditor
          project={project}
          column={columnEditor === "new" ? undefined : columnEditor}
          onClose={() => setColumnEditor(null)}
          onChange={() => {
            setColumnEditor(null);
            refresh();
          }}
        />
      )}
      {taskEditor && (
        <TaskEditor
          project={project}
          task={taskEditor.task}
          columnId={taskEditor.columnId}
          user={user}
          workspaceRole={workspace?.role}
          onClose={(changed) => {
            setTaskEditor(null);
            if (changed) resource.refresh();
            if (window.location.search)
              router.replace(`/projects/${id}`, { scroll: false });
          }}
          onChange={(taskCountChanged) => {
            setTaskEditor(null);
            router.replace(`/projects/${id}`, { scroll: false });
            refresh(taskCountChanged);
          }}
        />
      )}
      {ai && (
        <AiPanel type={ai} project={project} onClose={() => setAi(null)} />
      )}
    </>
  );
}
