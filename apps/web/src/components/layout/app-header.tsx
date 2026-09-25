import styles from "./layout.module.css";
import { cx } from "../../lib/class-names";
import type { User, Workspace } from "../../lib/types";
import { Avatar } from "../ui/avatar";
import { Icon } from "../ui/icon";

export function AppHeader({
  pathname,
  currentWorkspace,
  user,
  onOpenNavigation,
}: {
  pathname: string;
  currentWorkspace?: Workspace;
  user: User;
  onOpenNavigation: () => void;
}) {
  return (
    <header className={styles["topbar"]}>
      <div className={styles["breadcrumb"]}>
        <button
          className={cx(
            styles["native-button"],
            styles["icon-button"],
            styles["mobile-only"],
          )}
          onClick={() => onOpenNavigation()}
          aria-label="Open navigation"
        >
          <Icon name="menu" />
        </button>
        <Icon name="folder" size={17} />
        <span>{currentWorkspace?.name || "Your workspace"}</span>
        <span className={styles["slash"]}>/</span>
        <strong>
          {pathname.startsWith("/projects/")
            ? "Project board"
            : pathname.startsWith("/workspaces/")
              ? "Workspace"
              : pathname === "/invite"
                ? "Invitation"
                : "Overview"}
        </strong>
      </div>
      <span className={styles["topbar-caption"]}>
        <span className={styles["live-dot"]} />A little more flow, every day.
      </span>
      <Avatar
        name={user.name}
        size="small"
        className={styles["topbarAvatar"]}
      />
    </header>
  );
}
