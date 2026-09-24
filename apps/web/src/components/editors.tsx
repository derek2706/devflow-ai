"use client";
import styles from "./editors.module.css";
import { cx } from "../lib/class-names";

import { FormEvent, useState } from "react";
import { errorText, itemOf, patch, post } from "../lib/api";
import { Project, Workspace } from "../lib/types";
import { ErrorBanner, Modal } from "./ui";

export function WorkspaceEditor({
  workspace,
  onClose,
  onSave,
}: {
  workspace?: Workspace;
  onClose: () => void;
  onSave: (workspace: Workspace) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const body = {
        name: form.get("name"),
        description: form.get("description"),
      };
      const data = await (workspace
        ? patch(`/workspaces/${workspace.id}`, body)
        : post("/workspaces", body));
      onSave(itemOf<Workspace>(data, "workspace"));
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={workspace ? "Workspace settings" : "A home for your team"}
      description={
        workspace
          ? "Update the details of your shared workspace."
          : "Give your team a space to organize, collaborate, and build."
      }
      onClose={onClose}
    >
      <form className={styles["form-stack"]} onSubmit={submit}>
        <ErrorBanner error={error} />
        <label className={styles["native-label"]}>
          Workspace name
          <input
            className={styles["native-input"]}
            name="name"
            defaultValue={workspace?.name}
            placeholder="Acme Studio"
            minLength={2}
            maxLength={100}
            required
            autoFocus
          />
        </label>
        <label className={styles["native-label"]}>
          Description <span className={styles["muted"]}>(optional)</span>
          <textarea
            className={styles["native-textarea"]}
            name="description"
            defaultValue={workspace?.description || ""}
            placeholder="What will you build together?"
            rows={3}
            maxLength={2000}
          />
        </label>
        <div className={styles["modal-actions"]}>
          <button
            type="button"
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["secondary"],
            )}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            disabled={busy}
          >
            {busy ? "Saving…" : workspace ? "Save changes" : "Create workspace"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ProjectEditor({
  project,
  workspaceId,
  onClose,
  onSave,
}: {
  project?: Project;
  workspaceId: string;
  onClose: () => void;
  onSave: (project: Project) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState(project?.color || "#8b5cf6");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const body = {
        name: form.get("name"),
        description: form.get("description"),
        color,
      };
      const data = await (project
        ? patch(`/projects/${project.id}`, body)
        : post(`/workspaces/${workspaceId}/projects`, body));
      onSave(itemOf<Project>(data, "project"));
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={project ? "Project settings" : "Build something great"}
      description={
        project
          ? "Keep your project details up to date."
          : "A clear project brings a good idea one step closer."
      }
      onClose={onClose}
    >
      <form className={styles["form-stack"]} onSubmit={submit}>
        <ErrorBanner error={error} />
        <label className={styles["native-label"]}>
          Project name
          <input
            className={styles["native-input"]}
            name="name"
            defaultValue={project?.name}
            placeholder="Website redesign"
            minLength={2}
            maxLength={100}
            required
            autoFocus
          />
        </label>
        <label className={styles["native-label"]}>
          Description <span className={styles["muted"]}>(optional)</span>
          <textarea
            className={styles["native-textarea"]}
            name="description"
            defaultValue={project?.description || ""}
            placeholder="A little context goes a long way."
            rows={3}
            maxLength={2000}
          />
        </label>
        <fieldset
          className={cx(styles["native-fieldset"], styles["color-picker"])}
        >
          <legend className={styles["native-legend"]}>Project color</legend>
          {[
            "#8b5cf6",
            "#3b82f6",
            "#14b8a6",
            "#f59e0b",
            "#f43f5e",
            "#ec4899",
          ].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Color ${value}`}
              aria-pressed={color === value}
              className={cx(
                styles["native-button"],
                color === value ? styles["selected"] : undefined,
              )}
              style={{ backgroundColor: value }}
              onClick={() => setColor(value)}
            />
          ))}
        </fieldset>
        <div className={styles["modal-actions"]}>
          <button
            type="button"
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["secondary"],
            )}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            disabled={busy}
          >
            {busy ? "Saving…" : project ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
