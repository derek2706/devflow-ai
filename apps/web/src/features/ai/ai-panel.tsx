"use client";

import { Loading } from "../../components/ui/loading";
import { Modal } from "../../components/ui/modal";
import { SuccessBanner } from "../../components/ui/feedback";
import { useResource } from "../../hooks/use-resource";
import type { AiStatus } from "../../lib/types";
import { aiContent } from "./ai-content";
import { AiResultActions } from "./ai-result-actions";
import { AiResults } from "./ai-results";
import { AiStart, AiStatusNotice, SprintSettings } from "./ai-setup";
import type { AiPanelProps } from "./ai.types";
import { useAiDraft } from "./use-ai-draft";
import styles from "./ai.module.css";

export function AiPanel(props: AiPanelProps) {
  const { type, project, task, onClose, onApplied } = props;
  const status = useResource<AiStatus>("/ai/status");
  const draft = useAiDraft(props);
  const mode = draft.result?.mode || status.data?.mode;
  const content = aiContent[type];

  return (
    <Modal
      title={content.title}
      description={content.description}
      wide
      onClose={() => {
        if (draft.applied) onApplied?.();
        onClose();
      }}
    >
      <AiStatusNotice
        mode={mode}
        result={draft.result}
        error={draft.error || status.error}
      />
      {type === "sprint-plan" && !draft.result && (
        <SprintSettings
          goal={draft.goal}
          capacity={draft.capacity}
          onGoalChange={draft.setGoal}
          onCapacityChange={draft.setCapacity}
        />
      )}
      {!draft.result && !draft.busy && (
        <AiStart
          type={type}
          title={
            type === "subtasks"
              ? task?.title
              : type === "standup"
                ? "Turn the day's work into a useful update."
                : project?.name
          }
          mode={mode}
          onGenerate={draft.generate}
        />
      )}
      {draft.busy && (
        <Loading
          label={
            draft.result
              ? "Adding your tasks…"
              : "Finding a useful starting point…"
          }
        />
      )}
      {draft.result && (
        <div className={styles["ai-result"]}>
          <SuccessBanner
            message={
              draft.applied
                ? `${draft.applied} ${draft.applied === 1 ? "task added" : "tasks added"} to your board.`
                : undefined
            }
          />
          <AiResults
            draft={draft.result.result}
            onUpdateSubtask={draft.updateSubtask}
            onRemoveSubtask={draft.removeSubtask}
          />
          <AiResultActions
            type={type}
            draft={draft.result.result}
            busy={draft.busy}
            copied={draft.copied}
            onGenerate={draft.generate}
            onApply={draft.apply}
            onCopy={draft.copy}
          />
        </div>
      )}
    </Modal>
  );
}
