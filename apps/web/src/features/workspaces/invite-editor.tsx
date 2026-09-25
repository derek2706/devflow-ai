"use client";
import { useState, type FormEvent } from "react";
import { cx } from "../../lib/class-names";
import { errorText, post } from "../../lib/api";
import { ErrorBanner, SuccessBanner } from "../../components/ui/feedback";
import { Icon } from "../../components/ui/icon";
import { Modal } from "../../components/ui/modal";
import styles from "./workspace.module.css";
export function InviteEditor({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await post<{ inviteUrl: string }>(
        `/workspaces/${workspaceId}/invitations`,
        { email: form.get("email"), role: form.get("role") },
      );
      setUrl(new URL(result.inviteUrl, window.location.origin).href);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Great work is a team sport"
      description="Invite someone to collaborate in your workspace."
      onClose={onClose}
    >
      <ErrorBanner error={error} />
      {url ? (
        <div className={styles["form-stack"]}>
          <SuccessBanner message="Invitation created. Share this link with your teammate." />
          <label className={styles["native-label"]}>
            Invitation link
            <input
              className={styles["native-input"]}
              value={url}
              readOnly
              onFocus={(event) => event.target.select()}
            />
          </label>
          <p className={cx(styles["native-p"], styles["helper"])}>
            The recipient needs to sign in with the invited email address.
            Invitations expire after 7 days.
          </p>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setError(
                  "Copy unavailable. Select the invitation link above and copy it manually.",
                );
              }
            }}
          >
            <Icon name={copied ? "check" : "copy"} size={17} />
            {copied ? "Copied" : "Copy invitation link"}
          </button>
        </div>
      ) : (
        <form className={styles["form-stack"]} onSubmit={submit}>
          <label className={styles["native-label"]}>
            Email address
            <input
              className={styles["native-input"]}
              name="email"
              type="email"
              placeholder="teammate@company.com"
              required
              autoFocus
            />
          </label>
          <label className={styles["native-label"]}>
            Workspace role
            <select
              className={styles["native-select"]}
              name="role"
              defaultValue="MEMBER"
            >
              <option value="MEMBER">
                Member — collaborate on projects and tasks
              </option>
              <option value="ADMIN">
                Admin — also manage members and projects
              </option>
            </select>
          </label>
          <div className={styles["modal-actions"]}>
            <button
              type="button"
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["secondary"],
              )}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["primary"],
              )}
              disabled={busy}
            >
              {busy ? "Creating…" : "Create invitation"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
