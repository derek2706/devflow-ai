import { Icon } from "../../components/ui/icon";
import { cx } from "../../lib/class-names";
import type { AiAction, AiDraft } from "./ai.types";
import styles from "./ai.module.css";

export function AiResultActions({
  type,
  draft,
  busy,
  copied,
  onGenerate,
  onApply,
  onCopy,
}: {
  type: AiAction;
  draft: AiDraft;
  busy: boolean;
  copied: boolean;
  onGenerate: () => void;
  onApply: () => void;
  onCopy: () => void;
}) {
  return (
    <>
      <div className={styles["ai-result-note"]}>
        <Icon name="sparkle" size={15} />
        This is a draft. Your team&apos;s judgment comes first.
        {type === "sprint-plan" && " No tasks or dates have been changed."}
      </div>
      <div className={styles["modal-actions"]}>
        <button
          className={cx(
            styles["native-button"],
            styles["button"],
            styles["secondary"],
          )}
          disabled={busy}
          onClick={onGenerate}
        >
          Generate again
        </button>
        {type === "subtasks" ? (
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            disabled={
              busy ||
              !draft.subtasks?.length ||
              draft.subtasks.some((subtask) => !subtask.title.trim())
            }
            onClick={onApply}
          >
            <Icon name="plus" size={17} />
            Add {draft.subtasks?.length || 0} tasks to board
          </button>
        ) : (
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            onClick={onCopy}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
            {copied ? "Copied" : "Copy draft"}
          </button>
        )}
      </div>
    </>
  );
}
