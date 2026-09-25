"use client";
import styles from "./project.module.css";
import { cx } from "../../lib/class-names";
import { useState, type FormEvent } from "react";
import { errorText, patch, post, remove } from "../../lib/api";
import type { Column, Project } from "../../lib/types";
import { ErrorBanner } from "../../components/ui/feedback";
import { Modal } from "../../components/ui/modal";

export interface ColumnEditorProps {
  project: Project;
  column?: Column;
  onClose: () => void;
  onChange: () => void;
}

export function ColumnEditor({
  project,
  column,
  onClose,
  onChange,
}: ColumnEditorProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      isDone: form.get("isDone") === "on",
      ...(column ? { position: Number(form.get("position")) } : {}),
    };
    try {
      if (column) await patch(`/columns/${column.id}`, body);
      else await post(`/projects/${project.id}/columns`, body);
      onChange();
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  async function deleteColumn() {
    if (
      !window.confirm(
        `Delete “${column?.name}”? Move its tasks to another column first.`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove(`/columns/${column?.id}`);
      onChange();
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={column ? "Edit column" : "Add a column"}
      description="Shape the board around how your team works."
      onClose={onClose}
    >
      <form className={styles["form-stack"]} onSubmit={submit}>
        <ErrorBanner error={error} />
        <label className={styles["native-label"]}>
          Column name
          <input
            className={styles["native-input"]}
            name="name"
            defaultValue={column?.name}
            placeholder="In review"
            maxLength={80}
            required
            autoFocus
          />
        </label>
        {column && (
          <label className={styles["native-label"]}>
            Board position
            <select
              className={styles["native-select"]}
              name="position"
              defaultValue={column.position}
            >
              {project.columns.map((entry, index) => (
                <option value={index} key={entry.id}>
                  {index + 1}
                  {index === 0
                    ? " — first"
                    : index === project.columns.length - 1
                      ? " — last"
                      : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={cx(styles["native-label"], styles["checkbox-label"])}>
          <input
            className={styles["native-input"]}
            type="checkbox"
            name="isDone"
            defaultChecked={column?.isDone}
          />
          Tasks in this column are completed
        </label>
        <p className={cx(styles["native-p"], styles["helper"])}>
          Completed columns count toward project progress and dashboard totals.
        </p>
        <div className={styles["modal-actions"]}>
          {column && (
            <button
              type="button"
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["danger-button"],
              )}
              onClick={deleteColumn}
              disabled={busy || !!column.tasks.length}
              title={
                column.tasks.length
                  ? "Move all tasks before deleting this column"
                  : undefined
              }
            >
              Delete
            </button>
          )}
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
            {busy ? "Saving…" : column ? "Save changes" : "Add column"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
