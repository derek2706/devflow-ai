"use client";

import { useState } from "react";
import { errorText, post } from "../../lib/api";
import type { AiResult } from "../../lib/types";
import { draftText } from "./ai-content";
import type { AiPanelProps, UpdateSubtask } from "./ai.types";

export function useAiDraft({
  type,
  project,
  task,
  workspaceId,
}: Pick<AiPanelProps, "type" | "project" | "task" | "workspaceId">) {
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState("");
  const [capacity, setCapacity] = useState(5);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(0);

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
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

  const updateSubtask: UpdateSubtask = (index, key, value) => {
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
  };

  function removeSubtask(index: number) {
    if (result)
      setResult({
        ...result,
        result: {
          ...result.result,
          subtasks: result.result.subtasks?.filter((_, i) => i !== index),
        },
      });
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(draftText(result.result));
      setCopied(true);
    } catch {
      setError(
        "Clipboard unavailable. You can select and copy the draft above.",
      );
    }
  }

  return {
    result,
    error,
    busy,
    goal,
    setGoal,
    capacity,
    setCapacity,
    copied,
    applied,
    generate,
    apply,
    updateSubtask,
    removeSubtask,
    copy,
  };
}
