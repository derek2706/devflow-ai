import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";

export function Loading({
  label = "Loading your workspace…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cx(styles["loading"], className)} role="status">
      <span className={styles["spinner"]} />
      {label}
    </div>
  );
}
