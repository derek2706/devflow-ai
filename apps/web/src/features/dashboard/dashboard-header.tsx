"use client";
import styles from "./dashboard.module.css";
import { cx } from "../../lib/class-names";
import { Icon } from "../../components/ui/icon";
export function DashboardHeader({
  userName,
  hasWorkspace,
  onCreate,
}: {
  userName: string;
  hasWorkspace: boolean;
  onCreate: () => void;
}) {
  return (
    <div className={styles["page-heading"]}>
      <div>
        <span className={styles["eyebrow"]}>
          LET&apos;S MOVE THINGS FORWARD
        </span>
        <h1 className={styles["native-h1"]}>
          Welcome back, {userName.split(" ")[0]}{" "}
          <span className={styles["greeting-dot"]}>✦</span>
        </h1>
        <p className={styles["native-p"]}>
          Here&apos;s what&apos;s happening with your team today.
        </p>
      </div>
      <button
        className={cx(
          styles["native-button"],
          styles["button"],
          styles["primary"],
        )}
        onClick={() => onCreate()}
      >
        <Icon name="plus" size={18} />
        {hasWorkspace ? "New project" : "Create workspace"}
      </button>
    </div>
  );
}
