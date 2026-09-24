"use client";
import styles from "./workspace.module.css";
import { cx } from "../lib/class-names";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { errorText, itemOf, listOf, patch, post, remove } from "../lib/api";
import { Member, Project, User, Workspace } from "../lib/types";
import {
  Avatar,
  Empty,
  ErrorBanner,
  Icon,
  Loading,
  Modal,
  SuccessBanner,
  useResource,
} from "./ui";
import { ProjectEditor, WorkspaceEditor } from "./editors";
import { ProjectCard } from "./dashboard";

export function WorkspaceView({
  id,
  user,
  onChange,
}: {
  id: string;
  user: User;
  onChange: () => void;
}) {
  const router = useRouter();
  const resource = useResource<{ workspace: Workspace }>(`/workspaces/${id}`);
  const projectsResource = useResource<{ projects: Project[] }>(
    `/workspaces/${id}/projects`,
  );
  const workspace = resource.data
    ? itemOf<Workspace>(resource.data, "workspace")
    : undefined;
  const projects = listOf<Project>(projectsResource.data, "projects");
  const [tab, setTab] = useState("projects");
  const [settings, setSettings] = useState(false);
  const [createProject, setCreateProject] = useState(false);
  const [invite, setInvite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const ownRole =
    workspace?.role ||
    workspace?.members?.find((member) => member.userId === user.id)?.role;
  const canManage = ownRole === "OWNER" || ownRole === "ADMIN";
  async function memberAction(member: Member, role?: string) {
    if (
      !role &&
      !window.confirm(
        `Remove ${member.user.name} from this workspace? They will lose access to its projects.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (role)
        await patch(`/workspaces/${id}/members/${member.userId}`, { role });
      else await remove(`/workspaces/${id}/members/${member.userId}`);
      resource.refresh();
      onChange();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function deleteWorkspace() {
    if (
      !window.confirm(
        `Delete “${workspace?.name}” and all its projects, tasks, and comments? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await remove(`/workspaces/${id}`);
      onChange();
      router.push("/dashboard");
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  if (!workspace)
    return (
      <>
        <ErrorBanner error={resource.error} />
        {resource.loading && <Loading />}
      </>
    );
  return (
    <>
      <div className={styles["page-heading"]}>
        <div>
          <span className={styles["eyebrow"]}>A PLACE FOR YOUR PEOPLE</span>
          <h1 className={styles["native-h1"]}>{workspace.name}</h1>
          <p className={styles["native-p"]}>
            {workspace.description ||
              "Great work happens together. Let's get started."}
          </p>
        </div>
        <div className={styles["button-row"]}>
          {canManage && (
            <button
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["secondary"],
              )}
              onClick={() => setInvite(true)}
            >
              <Icon name="users" size={17} />
              Invite members
            </button>
          )}
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            onClick={() => setCreateProject(true)}
          >
            <Icon name="plus" size={17} />
            New project
          </button>
        </div>
      </div>
      <div className={styles["tabs"]}>
        <button
          className={cx(
            styles["native-button"],
            tab === "projects" ? styles["selected"] : undefined,
          )}
          onClick={() => setTab("projects")}
        >
          <Icon name="folder" size={17} />
          Projects<span className={styles["count"]}>{projects.length}</span>
        </button>
        <button
          className={cx(
            styles["native-button"],
            tab === "members" ? styles["selected"] : undefined,
          )}
          onClick={() => setTab("members")}
        >
          <Icon name="users" size={17} />
          Members
          <span className={styles["count"]}>
            {workspace.members?.length || workspace.memberCount || 0}
          </span>
        </button>
        {canManage && (
          <button
            className={cx(
              styles["native-button"],
              tab === "settings" ? styles["selected"] : undefined,
            )}
            onClick={() => setTab("settings")}
          >
            <Icon name="settings" size={17} />
            Settings
          </button>
        )}
      </div>
      <ErrorBanner error={error || projectsResource.error} />
      {tab === "projects" && (
        <>
          <div className={styles["section-heading"]}>
            <h2 className={styles["native-h2"]}>All projects</h2>
            <label
              className={cx(styles["native-label"], styles["search-field"])}
            >
              <Icon name="search" size={17} />
              <input
                className={styles["native-input"]}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a project…"
                aria-label="Search projects"
              />
            </label>
          </div>
          {projectsResource.loading && !projectsResource.data ? (
            <Loading />
          ) : projects.length ? (
            <div
              className={cx(
                styles["projects-grid"],
                styles["workspace-projects"],
              )}
            >
              {projects
                .filter((project) =>
                  project.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    className={styles.workspaceProjectCard}
                  />
                ))}
              {!search && (
                <button
                  className={cx(
                    styles["native-button"],
                    styles["new-project-card"],
                  )}
                  onClick={() => setCreateProject(true)}
                >
                  <span>
                    <Icon name="plus" size={24} />
                  </span>
                  <strong>Create a project</strong>
                  <small>Give your next idea a home</small>
                </button>
              )}
              {search &&
                !projects.some((project) =>
                  project.name.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <Empty
                    icon="search"
                    title="No projects found"
                    description="Try a different name."
                  />
                )}
            </div>
          ) : (
            <div className={styles["panel"]}>
              <Empty
                title="Room for your next big idea"
                description="Create a project to start planning your team's work."
              >
                <button
                  className={cx(
                    styles["native-button"],
                    styles["button"],
                    styles["primary"],
                  )}
                  onClick={() => setCreateProject(true)}
                >
                  Create your first project
                </button>
              </Empty>
            </div>
          )}
        </>
      )}
      {tab === "members" && (
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
            {workspace.members?.map((member) => (
              <div className={styles["member-row"]} key={member.userId}>
                <Avatar
                  name={member.user.name}
                  className={styles.memberAvatar}
                />
                <div className={styles["member-name"]}>
                  <strong>
                    {member.user.name}{" "}
                    {member.userId === user.id && (
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
                member.userId !== user.id ? (
                  <>
                    <select
                      className={styles["native-select"]}
                      aria-label={`Role for ${member.user.name}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(event) =>
                        memberAction(member, event.target.value)
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
                      onClick={() => memberAction(member)}
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
            Owners manage everything. Admins manage members and projects.
            Members collaborate on projects they belong to.
          </div>
        </section>
      )}
      {tab === "settings" && canManage && (
        <div className={styles["settings-stack"]}>
          <section className={cx(styles["panel"], styles["settings-row"])}>
            <div>
              <h2 className={styles["native-h2"]}>Workspace details</h2>
              <p className={styles["native-p"]}>
                Give your shared space a name and a purpose.
              </p>
            </div>
            <button
              className={cx(
                styles["native-button"],
                styles["button"],
                styles["secondary"],
              )}
              onClick={() => setSettings(true)}
            >
              Edit details
            </button>
          </section>
          {ownRole === "OWNER" && (
            <section
              className={cx(
                styles["panel"],
                styles["settings-row"],
                styles["danger-zone"],
              )}
            >
              <div>
                <h2 className={styles["native-h2"]}>Delete workspace</h2>
                <p className={styles["native-p"]}>
                  Permanently remove this workspace and everything inside it.
                </p>
              </div>
              <button
                className={cx(
                  styles["native-button"],
                  styles["button"],
                  styles["danger-button"],
                )}
                onClick={deleteWorkspace}
                disabled={busy}
              >
                Delete workspace
              </button>
            </section>
          )}
        </div>
      )}
      {settings && (
        <WorkspaceEditor
          workspace={workspace}
          onClose={() => setSettings(false)}
          onSave={() => {
            setSettings(false);
            resource.refresh();
            onChange();
          }}
        />
      )}
      {createProject && (
        <ProjectEditor
          workspaceId={id}
          onClose={() => setCreateProject(false)}
          onSave={(project) => {
            setCreateProject(false);
            onChange();
            router.push(`/projects/${project.id}`);
          }}
        />
      )}
      {invite && (
        <InviteEditor workspaceId={id} onClose={() => setInvite(false)} />
      )}
    </>
  );
}
function InviteEditor({
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
