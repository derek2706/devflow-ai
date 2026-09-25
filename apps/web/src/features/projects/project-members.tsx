"use client";
import styles from "./project.module.css";
import { cx } from "../../lib/class-names";
import { useState, type FormEvent } from "react";
import { errorText, listOf, post, remove } from "../../lib/api";
import type { Member, Project } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { Empty } from "../../components/ui/empty";
import { ErrorBanner } from "../../components/ui/feedback";
import { Icon } from "../../components/ui/icon";
import { Modal } from "../../components/ui/modal";
import { useResource } from "../../hooks/use-resource";

export interface ProjectMembersProps {
  project: Project;
  canManage: boolean;
  onClose: () => void;
  onChange: () => void;
}

export function ProjectMembers({
  project,
  canManage,
  onClose,
  onChange,
}: ProjectMembersProps) {
  const resource = useResource<{ members: Member[] }>(
    `/workspaces/${project.workspaceId}/members`,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const available = listOf<Member>(resource.data, "members").filter(
    (member) =>
      !project.members.some((existing) => existing.userId === member.userId),
  );
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post(`/projects/${project.id}/members`, {
        userId: form.get("userId"),
      });
      onChange();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function deleteMember(member: Member) {
    if (!window.confirm(`Remove ${member.user.name} from the project team?`))
      return;
    setBusy(true);
    try {
      await remove(`/projects/${project.id}/members/${member.userId}`);
      onChange();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Your project team"
      description="Add workspace teammates to grant project access and assign them tasks."
      onClose={onClose}
    >
      <ErrorBanner error={error || resource.error} />
      <div className={cx(styles["member-list"], styles["compact"])}>
        {project.members.map((member) => (
          <div className={styles["member-row"]} key={member.userId}>
            <Avatar name={member.user.name} className={styles.memberAvatar} />
            <strong className={styles["member-name"]}>
              {member.user.name}
            </strong>
            {canManage && member.userId !== project.createdById && (
              <button
                className={cx(
                  styles["native-button"],
                  styles["icon-button"],
                  styles["danger"],
                )}
                disabled={busy}
                onClick={() => deleteMember(member)}
                aria-label={`Remove ${member.user.name}`}
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!project.members.length && (
        <Empty
          icon="users"
          title="Build your project team"
          description="Add people from the workspace to assign them tasks."
        />
      )}
      {canManage && (
        <form className={styles["form-stack"]} onSubmit={add}>
          <label className={styles["native-label"]}>
            Add a workspace member
            <select
              className={styles["native-select"]}
              name="userId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                {available.length
                  ? "Choose a teammate"
                  : "All workspace members are on this project"}
              </option>
              {available.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            disabled={busy || !available.length}
          >
            {busy ? "Saving…" : "Add to project"}
          </button>
        </form>
      )}
    </Modal>
  );
}
