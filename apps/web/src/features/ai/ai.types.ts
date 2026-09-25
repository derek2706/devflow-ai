import type { AiResult, Project, Task } from "../../lib/types";

export type AiAction =
  | "subtasks"
  | "project-summary"
  | "sprint-plan"
  | "standup";

export type AiPanelProps = {
  type: AiAction;
  project?: Project;
  task?: Task;
  workspaceId?: string;
  onClose: () => void;
  onApplied?: () => void;
};

export type AiDraft = AiResult["result"];
export type SubtaskSuggestion = NonNullable<AiDraft["subtasks"]>[number];
export type SubtaskField = "title" | "description";
export type UpdateSubtask = (
  index: number,
  field: SubtaskField,
  value: string,
) => void;
