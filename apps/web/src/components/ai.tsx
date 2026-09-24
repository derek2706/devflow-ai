"use client";
import styles from "./ai.module.css";
import { cx } from "../lib/class-names";

import { useState } from "react";
import { errorText, post } from "../lib/api";
import { AiResult, Project, Task } from "../lib/types";
import {
  ErrorBanner,
  Icon,
  Loading,
  Modal,
  SuccessBanner,
  useResource,
} from "./ui";

export function AiPanel({
  type,
  project,
  task,
  workspaceId,
  onClose,
  onApplied,
}: {
  type: "subtasks" | "project-summary" | "sprint-plan" | "standup";
  project?: Project;
  task?: Task;
  workspaceId?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const status = useResource<{ mode: "local" | "provider" }>("/ai/status");
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState("");
  const [capacity, setCapacity] = useState(5);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(0);
  const titles = {
    subtasks: "Break it into small wins",
    "project-summary": "The bigger picture",
    "sprint-plan": "Make a plan. Build momentum.",
    standup: "Your progress, brought together",
  };
  const descriptions = {
    subtasks:
      "A starting point for your next steps. Review and edit before adding tasks.",
    "project-summary":
      "A clear view of where your project stands and what needs attention.",
    "sprint-plan":
      "A suggested focus for your next sprint, grounded in your actual tasks.",
    standup: "A draft you can use to share what moved forward and what's next.",
  };
  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    setApplied(0);
    try {
      const data = await post<AiResult>(
        `/ai/${type}`,
        type === "subtasks"
          ? { taskId: task?.id }
          : type === "standup"
            ? { workspaceId }
            : type === "sprint-plan"
              ? { projectId: project?.id, goal: goal || undefined, capacity }
              : { projectId: project?.id },
      );
      setResult(data);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!task || !project || !result?.result.subtasks?.length) return;
    setBusy(true);
    setError("");
    let saved = 0;
    try {
      for (const subtask of result.result.subtasks) {
        await post(`/projects/${project.id}/tasks`, {
          title: subtask.title,
          description: `Follow-up to: ${task.title}\n\n${subtask.description}`,
          priority: subtask.priority,
          columnId: task.columnId,
          labels: task.labels || [],
          assigneeId: task.assigneeId || null,
        });
        saved++;
        setApplied((value) => value + 1);
      }
      setResult({ ...result, result: { ...result.result, subtasks: [] } });
    } catch (error) {
      setError(
        `${saved ? `${saved} tasks added. ` : ""}${errorText(error)} You can retry the remaining tasks.`,
      );
      setResult({
        ...result,
        result: {
          ...result.result,
          subtasks: result.result.subtasks.slice(saved),
        },
      });
    } finally {
      setBusy(false);
    }
  }
  const mode = result?.mode || status.data?.mode;
  function updateSubtask(
    index: number,
    key: "title" | "description",
    value: string,
  ) {
    if (result)
      setResult({
        ...result,
        result: {
          ...result.result,
          subtasks: result.result.subtasks?.map((subtask, i) =>
            i === index ? { ...subtask, [key]: value } : subtask,
          ),
        },
      });
  }
  return (
    <Modal
      title={titles[type]}
      description={descriptions[type]}
      wide
      onClose={() => {
        if (applied) onApplied?.();
        onClose();
      }}
    >
      <div className={styles["ai-mode"]}>
        <span className={styles["ai-engine"]}>
          <Icon name="sparkle" size={15} />
          {mode === "local"
            ? "Local planning assistant"
            : mode === "provider"
              ? "AI assistant"
              : "Checking assistant…"}
        </span>
        <span>
          {mode === "local"
            ? "Rule-based suggestions · no external service"
            : mode === "provider"
              ? "Uses project/task content when you generate"
              : ""}
        </span>
      </div>
      <ErrorBanner error={error || status.error} />
      {type === "sprint-plan" && !result && (
        <div className={cx(styles["form-grid"], styles["ai-inputs"])}>
          <label className={styles["native-label"]}>
            Sprint goal <span className={styles["muted"]}>(optional)</span>
            <input
              className={styles["native-input"]}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Ship our first release"
              maxLength={500}
            />
          </label>
          <label className={styles["native-label"]}>
            Task capacity
            <input
              className={styles["native-input"]}
              type="number"
              value={capacity}
              min={1}
              max={30}
              onChange={(event) =>
                setCapacity(
                  Math.max(1, Math.min(30, Number(event.target.value))),
                )
              }
            />
          </label>
        </div>
      )}
      {!result && !busy && (
        <div className={styles["ai-start"]}>
          <span className={styles["ai-orb"]}>
            <Icon name="sparkle" size={30} />
          </span>
          <h3 className={styles["native-h3"]}>
            {type === "subtasks"
              ? task?.title
              : type === "standup"
                ? "Turn the day's work into a useful update."
                : project?.name}
          </h3>
          <p className={styles["native-p"]}>
            {mode === "local"
              ? "Your local assistant uses task details, due dates, and priorities to organize a practical starting point."
              : "Get a useful first draft from your team's work. Review suggestions and make them your own."}
          </p>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            onClick={generate}
            disabled={!mode}
          >
            <Icon name="sparkle" size={17} />
            {type === "subtasks"
              ? "Suggest subtasks"
              : type === "project-summary"
                ? "Generate summary"
                : type === "sprint-plan"
                  ? "Suggest sprint plan"
                  : "Generate standup"}
          </button>
        </div>
      )}
      {busy && (
        <Loading
          label={
            result ? "Adding your tasks…" : "Finding a useful starting point…"
          }
        />
      )}
      {result && (
        <div className={styles["ai-result"]}>
          <SuccessBanner
            message={
              applied
                ? `${applied} ${applied === 1 ? "task added" : "tasks added"} to your board.`
                : undefined
            }
          />
          {result.result.subtasks && (
            <div className={styles["subtask-proposals"]}>
              {result.result.subtasks.map((subtask, index) => (
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
                          updateSubtask(index, "title", event.target.value)
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
                          updateSubtask(
                            index,
                            "description",
                            event.target.value,
                          )
                        }
                        rows={2}
                        maxLength={10000}
                      />
                    </label>
                  </div>
                  <button
                    className={cx(
                      styles["native-button"],
                      styles["icon-button"],
                    )}
                    aria-label={`Remove suggestion ${index + 1}`}
                    onClick={() =>
                      setResult({
                        ...result,
                        result: {
                          ...result.result,
                          subtasks: result.result.subtasks?.filter(
                            (_, i) => i !== index,
                          ),
                        },
                      })
                    }
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {result.result.summary && (
            <p className={cx(styles["native-p"], styles["ai-summary"])}>
              {result.result.summary}
            </p>
          )}
          {result.result.goal && (
            <div className={styles["ai-goal"]}>
              <span className={styles["eyebrow"]}>SPRINT FOCUS</span>
              <h3 className={styles["native-h3"]}>{result.result.goal}</h3>
            </div>
          )}
          {result.result.tasks && (
            <ol className={styles["sprint-tasks"]}>
              {result.result.tasks.map((item, index) => (
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
          {[
            { key: "highlights", label: "Highlights", icon: "check" },
            { key: "risks", label: "Needs attention", icon: "clock" },
            { key: "completed", label: "Completed", icon: "check" },
            { key: "inProgress", label: "In progress", icon: "activity" },
            { key: "blockers", label: "Blockers / attention", icon: "clock" },
            { key: "notes", label: "Planning notes", icon: "board" },
          ].map(({ key, label, icon }) => {
            const values =
              result.result[
                key as
                  | "highlights"
                  | "risks"
                  | "completed"
                  | "inProgress"
                  | "blockers"
                  | "notes"
              ];
            return values ? (
              <section className={styles["ai-section"]} key={key}>
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
            ) : null;
          })}
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
              onClick={generate}
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
                  !result.result.subtasks?.length ||
                  result.result.subtasks.some(
                    (subtask) => !subtask.title.trim(),
                  )
                }
                onClick={apply}
              >
                <Icon name="plus" size={17} />
                Add {result.result.subtasks?.length || 0} tasks to board
              </button>
            ) : (
              <button
                className={cx(
                  styles["native-button"],
                  styles["button"],
                  styles["primary"],
                )}
                onClick={async () => {
                  const content = Object.entries(result.result)
                    .map(
                      ([key, value]) =>
                        `${key.replace(/([A-Z])/g, " $1").toUpperCase()}\n${Array.isArray(value) ? value.map((item) => (typeof item === "string" ? `• ${item}` : `• ${item.title}${"reason" in item ? ` — ${item.reason}` : ""}`)).join("\n") : value}`,
                    )
                    .join("\n\n");
                  try {
                    await navigator.clipboard.writeText(content);
                    setCopied(true);
                  } catch {
                    setError(
                      "Clipboard unavailable. You can select and copy the draft above.",
                    );
                  }
                }}
              >
                <Icon name={copied ? "check" : "copy"} size={16} />
                {copied ? "Copied" : "Copy draft"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
