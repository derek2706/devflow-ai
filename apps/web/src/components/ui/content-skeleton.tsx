import styles from "./ui.module.css";

export function ContentSkeleton({
  label = "Loading your workspace…",
  heading = true,
}: {
  label?: string;
  heading?: boolean;
}) {
  return (
    <div className={styles["content-skeleton"]} role="status" aria-busy="true">
      <span className={styles["sr-only"]}>{label}</span>
      <div aria-hidden="true">
        {heading && (
          <div className={styles["skeleton-heading"]}>
            <span />
            <span />
          </div>
        )}
        <div className={styles["skeleton-grid"]}>
          {[0, 1, 2].map((item) => (
            <div className={styles["skeleton-card"]} key={item}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
