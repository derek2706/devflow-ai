import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        styles["priority"],
        styles[priority.toLowerCase()],
        className,
      )}
    >
      <span>
        {priority === "URGENT"
          ? "!"
          : priority === "HIGH"
            ? "↑"
            : priority === "LOW"
              ? "↓"
              : "−"}
      </span>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}
