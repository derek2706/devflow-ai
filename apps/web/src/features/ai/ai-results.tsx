import { Icon } from "../../components/ui/icon";
import { cx } from "../../lib/class-names";
import type { AiDraft, SubtaskSuggestion, UpdateSubtask } from "./ai.types";
import styles from "./ai.module.css";

function SubtaskSuggestions({
  subtasks,
  onUpdate,
  onRemove,
}: {
  subtasks: SubtaskSuggestion[];
  onUpdate: UpdateSubtask;
  onRemove: (index: number) => void;
}) {
  return (
    <div className={styles["subtask-proposals"]}>
      {subtasks.map((subtask, index) => (
        <div className={styles["subtask-proposal"]} key={index}>
          <span className={styles["proposal-number"]}>{index + 1}</span>
          <div>
            <label className={styles["native-label"]}>
              <span className={styles["sr-only"]}>
                Subtask {index + 1} title
              </span>
              <input
                className={styles["native-input"]}
                value={subtask.title}
                onChange={(event) =>
                  onUpdate(index, "title", event.target.value)
                }
                maxLength={200}
              />
            </label>
            <label className={styles["native-label"]}>
              <span className={styles["sr-only"]}>
                Subtask {index + 1} description
              </span>
              <textarea
                className={styles["native-textarea"]}
                value={subtask.description}
                onChange={(event) =>
                  onUpdate(index, "description", event.target.value)
                }
                rows={2}
                maxLength={10000}
              />
            </label>
          </div>
          <button
            className={cx(styles["native-button"], styles["icon-button"])}
            aria-label={`Remove suggestion ${index + 1}`}
            onClick={() => onRemove(index)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SprintPlan({ goal, tasks }: Pick<AiDraft, "goal" | "tasks">) {
  return (
    <>
      {goal && (
        <div className={styles["ai-goal"]}>
          <span className={styles["eyebrow"]}>SPRINT FOCUS</span>
          <h3 className={styles["native-h3"]}>{goal}</h3>
        </div>
      )}
      {tasks && (
        <ol className={styles["sprint-tasks"]}>
          {tasks.map((item, index) => (
            <li key={`${item.taskId}-${index}`}>
              <span className={styles["proposal-number"]}>{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <p className={styles["native-p"]}>{item.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

const listSections = [
  { key: "highlights", label: "Highlights", icon: "check" },
  { key: "risks", label: "Needs attention", icon: "clock" },
  { key: "completed", label: "Completed", icon: "check" },
  { key: "inProgress", label: "In progress", icon: "activity" },
  { key: "blockers", label: "Blockers / attention", icon: "clock" },
  { key: "notes", label: "Planning notes", icon: "board" },
] as const;

function ResultSection({
  label,
  icon,
  values,
}: {
  label: string;
  icon: string;
  values: string[];
}) {
  return (
    <section className={styles["ai-section"]}>
      <h3 className={styles["native-h3"]}>
        <Icon name={icon} size={17} />
        {label}
      </h3>
      {values.length ? (
        <ul>
          {values.map((value, index) => (
            <li key={index}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className={cx(styles["native-p"], styles["helper"])}>
          Nothing to report.
        </p>
      )}
    </section>
  );
}

export function AiResults({
  draft,
  onUpdateSubtask,
  onRemoveSubtask,
}: {
  draft: AiDraft;
  onUpdateSubtask: UpdateSubtask;
  onRemoveSubtask: (index: number) => void;
}) {
  return (
    <>
      {draft.subtasks && (
        <SubtaskSuggestions
          subtasks={draft.subtasks}
          onUpdate={onUpdateSubtask}
          onRemove={onRemoveSubtask}
        />
      )}
      {draft.summary && (
        <p className={cx(styles["native-p"], styles["ai-summary"])}>
          {draft.summary}
        </p>
      )}
      <SprintPlan goal={draft.goal} tasks={draft.tasks} />
      {listSections.map(({ key, label, icon }) => {
        const values = draft[key];
        return values ? (
          <ResultSection key={key} label={label} icon={icon} values={values} />
        ) : null;
      })}
    </>
  );
}
