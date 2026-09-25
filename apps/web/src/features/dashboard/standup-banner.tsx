"use client";
import styles from "./dashboard.module.css";
import { cx } from "../../lib/class-names";
import { Icon } from "../../components/ui/icon";
export function StandupBanner({
  disabled,
  onGenerate,
}: {
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className={styles["ai-banner"]}>
      <div className={styles["ai-orb"]}>
        <Icon name="sparkle" size={26} />
      </div>
      <div>
        <span className={styles["eyebrow"]}>A THOUGHTFUL HEAD START</span>
        <h2 className={styles["native-h2"]}>
          Your standup, without the scramble.
        </h2>
        <p className={styles["native-p"]}>
          Bring your team&apos;s progress together in a few seconds.
        </p>
      </div>
      <button
        className={cx(
          styles["native-button"],
          styles["button"],
          styles["ai-button"],
        )}
        onClick={() => onGenerate()}
        disabled={disabled}
      >
        <Icon name="sparkle" size={17} />
        Generate standup
        <Icon name="arrow" size={16} />
      </button>
    </div>
  );
}
