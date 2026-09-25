"use client";
import styles from "./workspace.module.css";
import { cx } from "../../lib/class-names";
import type { Member, Role } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { Icon } from "../../components/ui/icon";
export function WorkspaceMembers({
  members,
  currentUserId,
  canManage,
  busy,
  onRoleChange,
  onRemove,
}: {
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  busy: boolean;
  onRoleChange: (member: Member, role: Exclude<Role, "OWNER">) => void;
  onRemove: (member: Member) => void;
}) {
  return (
    <section className={styles["panel"]}>
      <div className={styles["panel-heading"]}>
        <div>
          <h2 className={styles["native-h2"]}>
            The people behind the progress
          </h2>
          <p className={styles["native-p"]}>
            Add teammates to individual projects to give them access to the
            work.
          </p>
        </div>
      </div>
      <div className={styles["member-list"]}>
        {members.map((member) => (
          <div className={styles["member-row"]} key={member.userId}>
            <Avatar name={member.user.name} className={styles.memberAvatar} />
            <div className={styles["member-name"]}>
              <strong>
                {member.user.name}{" "}
                {member.userId === currentUserId && (
                  <span className={styles["muted"]}>(you)</span>
                )}
              </strong>
              <span>
                {member.role === "OWNER"
                  ? "Workspace owner"
                  : member.role === "ADMIN"
                    ? "Workspace administrator"
                    : "Team member"}
              </span>
            </div>
            {canManage &&
            member.role !== "OWNER" &&
            member.userId !== currentUserId ? (
              <>
                <select
                  className={styles["native-select"]}
                  aria-label={`Role for ${member.user.name}`}
                  value={member.role}
                  disabled={busy}
                  onChange={(event) =>
                    onRoleChange(
                      member,
                      event.target.value === "ADMIN" ? "ADMIN" : "MEMBER",
                    )
                  }
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  className={cx(
                    styles["native-button"],
                    styles["icon-button"],
                    styles["danger"],
                  )}
                  disabled={busy}
                  onClick={() => onRemove(member)}
                  aria-label={`Remove ${member.user.name}`}
                >
                  <Icon name="trash" size={17} />
                </button>
              </>
            ) : (
              <span className={styles["subtle-badge"]}>
                {member.role.toLowerCase()}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className={cx(styles["panel-footer"], styles["muted"])}>
        Owners manage everything. Admins manage members and projects. Members
        collaborate on projects they belong to.
      </div>
    </section>
  );
}
