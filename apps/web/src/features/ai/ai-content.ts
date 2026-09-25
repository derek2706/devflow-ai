import type { AiResult } from "../../lib/types";
import type { AiAction, AiDraft } from "./ai.types";

export const aiContent: Record<
  AiAction,
  { title: string; description: string; generateLabel: string }
> = {
  subtasks: {
    title: "Break it into small wins",
    description:
      "A starting point for your next steps. Review and edit before adding tasks.",
    generateLabel: "Suggest subtasks",
  },
  "project-summary": {
    title: "The bigger picture",
    description:
      "A clear view of where your project stands and what needs attention.",
    generateLabel: "Generate summary",
  },
  "sprint-plan": {
    title: "Make a plan. Build momentum.",
    description:
      "A suggested focus for your next sprint, grounded in your actual tasks.",
    generateLabel: "Suggest sprint plan",
  },
  standup: {
    title: "Your progress, brought together",
    description:
      "A draft you can use to share what moved forward and what's next.",
    generateLabel: "Generate standup",
  },
};

export const fallbackMessages: Record<
  NonNullable<AiResult["fallbackReason"]>,
  string
> = {
  quota:
    "The AI allowance or rate limit has been reached. Your local planner prepared this draft instead. You can try AI again later.",
  timeout:
    "AI took too long to respond. Your local planner prepared this draft instead.",
  unavailable:
    "AI is temporarily unavailable. Your local planner prepared this draft instead.",
  invalid_response:
    "The AI response could not be verified. Your local planner prepared this draft instead.",
};

export function draftText(draft: AiDraft) {
  return Object.entries(draft)
    .map(
      ([key, value]) =>
        `${key.replace(/([A-Z])/g, " $1").toUpperCase()}\n${Array.isArray(value) ? value.map((item) => (typeof item === "string" ? `• ${item}` : `• ${item.title}${"reason" in item ? ` — ${item.reason}` : ""}`)).join("\n") : value}`,
    )
    .join("\n\n");
}
