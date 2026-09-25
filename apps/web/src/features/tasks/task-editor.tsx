"use client";
import styles from "./task.module.css";
import { useState, type FormEvent } from "react";
import { errorText, patch, post, remove } from "../../lib/api";
import type { Project, Role, Task, User } from "../../lib/types";
import { Modal } from "../../components/ui/modal";
import { AiPanel } from "../ai/ai-panel";
import { TaskForm } from "./task-form";
import { TaskSidebar } from "./task-sidebar";

export interface TaskEditorProps {
  project: Project;
  task?: Task;
  columnId?: string;
  user: User;
  workspaceRole?: Role;
  onClose: (changed: boolean) => void;
  onChange: (taskCountChanged: boolean) => void;
}

export function TaskEditor({
  project,
  task,
  columnId,
  user,
  workspaceRole,
  onClose,
  onChange,
}: TaskEditorProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const [changed, setChanged] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = {
      title: form.get("title"),
      description: form.get("description"),
      priority: form.get("priority"),
      labels: [
        ...new Set(
          String(form.get("labels") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
      dueDate: form.get("dueDate")
        ? new Date(String(form.get("dueDate"))).toISOString()
        : null,
      assigneeId: form.get("assigneeId") || null,
    };
    const targetColumn = String(form.get("columnId"));
    if (
      body.labels.length > 20 ||
      body.labels.some((label) => label.length > 32)
    ) {
      setError("Use up to 20 labels, each 32 characters or fewer.");
      setBusy(false);
      return;
    }
    try {
      if (task) {
        await patch(`/tasks/${task.id}`, body);
        // Preserve a successful edit if a subsequent status move fails.
        setChanged(true);
        if (task.columnId !== targetColumn)
          await patch(`/tasks/${task.id}/move`, {
            columnId: targetColumn,
            position:
              project.columns.find((column) => column.id === targetColumn)
                ?.tasks.length || 0,
          });
      } else
        await post(`/projects/${project.id}/tasks`, {
          ...body,
          columnId: targetColumn,
        });
      onChange(!task);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  async function deleteTask() {
    if (
      !window.confirm(
        `Delete “${task?.title}” and its comments? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove(`/tasks/${task?.id}`);
      onChange(true);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title={task ? "Task details" : "A clear next step"}
        description={project.name}
        onClose={() => onClose(changed)}
        wide
      >
        <div className={styles["task-detail-layout"]}>
          <div className={styles["task-detail-main"]}>
            <TaskForm
              project={project}
              task={task}
              columnId={columnId}
              error={error}
              busy={busy}
              onSubmit={save}
              onDelete={deleteTask}
              onCancel={() => onClose(changed)}
            />
          </div>
          <TaskSidebar
            task={task}
            user={user}
            canModerate={workspaceRole === "OWNER" || workspaceRole === "ADMIN"}
            onGenerate={() => setAi(true)}
            onCommentsChange={() => setChanged(true)}
          />
        </div>
      </Modal>
      {ai && task && (
        <AiPanel
          type="subtasks"
          project={project}
          task={task}
          onClose={() => setAi(false)}
          onApplied={() => onChange(true)}
        />
      )}
    </>
  );
}
