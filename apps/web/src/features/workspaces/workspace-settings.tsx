"use client";
import styles from "./workspace.module.css";
import { cx } from "../../lib/class-names";
export function WorkspaceSettings({
  canDelete,
  busy,
  onEdit,
  onDelete,
}: {
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles["settings-stack"]}>
      <section className={cx(styles["panel"], styles["settings-row"])}>
        <div>
          <h2 className={styles["native-h2"]}>Workspace details</h2>
          <p className={styles["native-p"]}>
            Give your shared space a name and a purpose.
          </p>
        </div>
        <button
          className={cx(
            styles["native-button"],
            styles["button"],
            styles["secondary"],
          )}
          onClick={() => onEdit()}
        >
          Edit details
        </button>
      </section>
      {canDelete && (
        <section
          className={cx(
            styles["panel"],
            styles["settings-row"],
            styles["danger-zone"],
          )}
        >
          <div>
            <h2 className={styles["native-h2"]}>Delete workspace</h2>
            <p className={styles["native-p"]}>
              Permanently remove this workspace and everything inside it.
            </p>
          </div>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["danger-button"],
            )}
            onClick={onDelete}
            disabled={busy}
          >
            Delete workspace
          </button>
        </section>
      )}
    </div>
  );
}
