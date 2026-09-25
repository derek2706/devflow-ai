"use client";
import styles from "./workspace.module.css";
import { cx } from "../../lib/class-names";
import type { Workspace } from "../../lib/types";
import { Icon } from "../../components/ui/icon";
export function WorkspaceHeader({
  workspace,
  canManage,
  onInvite,
  onCreateProject,
}: {
  workspace: Workspace;
  canManage: boolean;
  onInvite: () => void;
  onCreateProject: () => void;
}) {
  return (
    <div className={styles["page-heading"]}>
      <div>
        <span className={styles["eyebrow"]}>A PLACE FOR YOUR PEOPLE</span>
        <h1 className={styles["native-h1"]}>{workspace.name}</h1>
        <p className={styles["native-p"]}>
          {workspace.description ||
            "Great work happens together. Let's get started."}
        </p>
      </div>
      <div className={styles["button-row"]}>
        {canManage && (
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["secondary"],
            )}
            onClick={() => onInvite()}
          >
            <Icon name="users" size={17} />
            Invite members
          </button>
        )}
        <button
          className={cx(
            styles["native-button"],
            styles["button"],
            styles["primary"],
          )}
          onClick={() => onCreateProject()}
        >
          <Icon name="plus" size={17} />
          New project
        </button>
      </div>
    </div>
  );
}
