"use client";
import styles from "./invitation.module.css";
import { cx } from "../../lib/class-names";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, post } from "../../lib/api";
import type { Workspace } from "../../lib/types";
import { Icon } from "../../components/ui/icon";
import { ErrorBanner } from "../../components/ui/feedback";

export function Invite({ onJoined }: { onJoined: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token)
        throw new Error(
          "This invitation is missing its token. Ask a workspace admin for a new link.",
        );
      const data = await post<{ workspace: Workspace }>("/invitations/accept", {
        token,
      });
      onJoined();
      router.push(`/workspaces/${data.workspace.id}`);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <div className={cx(styles["invite-panel"], styles["panel"])}>
      <span className={styles["empty-icon"]}>
        <Icon name="users" size={28} />
      </span>
      <span className={styles["eyebrow"]}>BETTER TOGETHER</span>
      <h1 className={styles["native-h1"]}>Your team is waiting</h1>
      <p className={styles["native-p"]}>
        Accept your invitation to join the workspace and start collaborating.
      </p>
      <ErrorBanner error={error} />
      <button
        className={cx(
          styles["native-button"],
          styles["button"],
          styles["primary"],
        )}
        onClick={accept}
        disabled={busy}
      >
        {busy ? "Joining…" : "Accept invitation"}
      </button>
      <Link
        className={cx(styles["native-a"], styles["text-link"])}
        href="/dashboard"
      >
        Back to my workspace
      </Link>
    </div>
  );
}
