import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";

export function Avatar({
  name,
  size = "normal",
  className,
}: {
  name?: string;
  size?: "small" | "normal" | "large";
  className?: string;
}) {
  return (
    <span
      title={name || "Unassigned"}
      className={cx(
        styles["avatar"],
        size !== "normal" && styles[size],
        className,
      )}
    >
      {name
        ? name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "?"}
    </span>
  );
}
