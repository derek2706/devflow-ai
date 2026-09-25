import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cx(styles["brand"], className)}>
      <span className={styles["brand-mark"]}>
        <svg
          className={styles["native-svg"]}
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m7 6 8 8-8 8M15 6l8 8-8 8"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          devflow<span className={styles["brand-ai"]}>AI</span>
        </span>
      )}
    </span>
  );
}
