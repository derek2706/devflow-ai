"use client";
import styles from "./workspace.module.css";
import { cx } from "../../lib/class-names";
import { Icon } from "../../components/ui/icon";
export type WorkspaceTab = "projects" | "members" | "settings";
export function WorkspaceTabs({
  tab,
  projectCount,
  memberCount,
  canManage,
  onTabChange,
}: {
  tab: WorkspaceTab;
  projectCount: number;
  memberCount: number;
  canManage: boolean;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className={styles["tabs"]}>
      <button
        className={cx(
          styles["native-button"],
          tab === "projects" ? styles["selected"] : undefined,
        )}
        onClick={() => onTabChange("projects")}
      >
        <Icon name="folder" size={17} />
        Projects<span className={styles["count"]}>{projectCount}</span>
      </button>
      <button
        className={cx(
          styles["native-button"],
          tab === "members" ? styles["selected"] : undefined,
        )}
        onClick={() => onTabChange("members")}
      >
        <Icon name="users" size={17} />
        Members
        <span className={styles["count"]}>{memberCount}</span>
      </button>
      {canManage && (
        <button
          className={cx(
            styles["native-button"],
            tab === "settings" ? styles["selected"] : undefined,
          )}
          onClick={() => onTabChange("settings")}
        >
          <Icon name="settings" size={17} />
          Settings
        </button>
      )}
    </div>
  );
}
