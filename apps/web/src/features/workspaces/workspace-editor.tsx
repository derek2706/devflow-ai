"use client";
import { useState, type FormEvent } from "react";
import { cx } from "../../lib/class-names";
import { errorText, itemOf, patch, post } from "../../lib/api";
import type { Workspace } from "../../lib/types";
import { ErrorBanner } from "../../components/ui/feedback";
import { Modal } from "../../components/ui/modal";
import styles from "./workspace-editor.module.css";
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
