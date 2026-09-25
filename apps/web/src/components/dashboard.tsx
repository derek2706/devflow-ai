"use client";
import styles from "./dashboard.module.css";
import { cx } from "../lib/class-names";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardData, Project, User, Workspace } from "../lib/types";
import {
  Avatar,
  ContentSkeleton,
  dateLabel,
  Empty,
  ErrorBanner,
  Icon,
  PriorityBadge,
  timeAgo,
  useResource,
} from "./ui";
import { ProjectEditor } from "./editors";
import { AiPanel } from "./ai";

export function ProjectCard({
  project,
  className,
  onNavigate,
}: {
  project: Project;
  className?: string;
  onNavigate?: (project: Pick<Project, "id" | "workspaceId">) => void;
}) {
  const tasks = project.columns?.flatMap((column) => column.tasks || []) || [];
  const total = project._count?.tasks ?? tasks.length;
  const completed =
    project.columns
      ?.filter((column) => column.isDone)
      .reduce((sum, column) => sum + (column.tasks?.length || 0), 0) || 0;
  return (
    <Link
      href={`/projects/${project.id}`}
      onNavigate={() => onNavigate?.(project)}
      className={cx(styles["native-a"], styles["project-card"], className)}
    >
      <div className={styles["project-card-top"]}>
        <span
          className={styles["project-icon"]}
          style={{ color: project.color, background: `${project.color}18` }}
        >
          <Icon name="folder" size={21} />
        </span>
        <Icon name="arrow" size={17} />
      </div>
      <h3 className={styles["native-h3"]}>{project.name}</h3>
      <p className={styles["native-p"]}>
        {project.description || "A space to turn ideas into progress."}
      </p>
      <div className={styles["project-card-meta"]}>
        <span>
          <Icon name="board" size={14} />
          {total} {total === 1 ? "task" : "tasks"}
        </span>
        <span>
          <Icon name="users" size={14} />
          {project._count?.members ?? project.members?.length ?? 0}
        </span>
      </div>
      {project.columns && (
        <div
          className={styles["project-progress"]}
          aria-label={`${completed} of ${total} tasks complete`}
        >
          <span
            style={{
              width: `${total ? (completed / total) * 100 : 0}%`,
              backgroundColor: project.color,
            }}
          />
        </div>
      )}
    </Link>
  );
}
export function Dashboard({
  user,
  workspace,
  workspaces,
  onCreateWorkspace,
  onChange,
  onProjectNavigate,
}: {
  user: User;
  workspace?: Workspace;
  workspaces: Workspace[];
  onCreateWorkspace: () => void;
  onChange: () => void;
  onProjectNavigate: (project: Pick<Project, "id" | "workspaceId">) => void;
}) {
  const router = useRouter();
  const resource = useResource<DashboardData>(
    `/dashboard${workspace ? `?workspaceId=${workspace.id}` : ""}`,
  );
  const [createProject, setCreateProject] = useState(false);
  const [ai, setAi] = useState(false);
  const data = resource.data;
  return (
    <>
      <div className={styles["page-heading"]}>
        <div>
          <span className={styles["eyebrow"]}>
            LET&apos;S MOVE THINGS FORWARD
          </span>
          <h1 className={styles["native-h1"]}>
            Welcome back, {user.name.split(" ")[0]}{" "}
            <span className={styles["greeting-dot"]}>✦</span>
          </h1>
          <p className={styles["native-p"]}>
            Here&apos;s what&apos;s happening with your team today.
          </p>
        </div>
        <button
          className={cx(
            styles["native-button"],
            styles["button"],
            styles["primary"],
          )}
          onClick={() =>
            workspace ? setCreateProject(true) : onCreateWorkspace()
          }
        >
          <Icon name="plus" size={18} />
          {workspace ? "New project" : "Create workspace"}
        </button>
      </div>
      <ErrorBanner error={resource.error} />
      {resource.loading && !data ? (
        <ContentSkeleton label="Loading your overview…" heading={false} />
      ) : (
        data && (
          <>
            <div className={styles["stats-grid"]}>
              {[
                {
                  label: "Total projects",
                  value: data.stats.projects,
                  icon: "folder",
                  color: "purple",
                  text: "Ideas in motion",
                },
                {
                  label: "Open tasks",
                  value: Math.max(
                    0,
                    data.stats.tasks - data.stats.completedTasks,
                  ),
                  icon: "board",
                  color: "blue",
                  text: "One step at a time",
                },
                {
                  label: "Completed",
                  value: data.stats.completedTasks,
                  icon: "check",
                  color: "green",
                  text: "Progress worth celebrating",
                },
                {
                  label: "Overdue tasks",
                  value: data.stats.overdueTasks,
                  icon: "clock",
                  color: "orange",
                  text: "A little attention needed",
                },
              ].map((stat) => (
                <div className={styles["stat-card"]} key={stat.label}>
                  <div className={styles["stat-top"]}>
                    <span>{stat.label}</span>
                    <span
                      className={cx(styles["stat-icon"], styles[stat.color])}
                    >
                      <Icon name={stat.icon} size={18} />
                    </span>
                  </div>
                  <strong>{stat.value ?? 0}</strong>
                  <small>{stat.text}</small>
                </div>
              ))}
            </div>
            <div className={styles["ai-banner"]}>
              <div className={styles["ai-orb"]}>
                <Icon name="sparkle" size={26} />
              </div>
              <div>
                <span className={styles["eyebrow"]}>
                  A THOUGHTFUL HEAD START
                </span>
                <h2 className={styles["native-h2"]}>
                  Your standup, without the scramble.
                </h2>
                <p className={styles["native-p"]}>
                  Bring your team&apos;s progress together in a few seconds.
                </p>
              </div>
              <button
                className={cx(
                  styles["native-button"],
                  styles["button"],
                  styles["ai-button"],
                )}
                onClick={() => setAi(true)}
                disabled={!workspace}
              >
                <Icon name="sparkle" size={17} />
                Generate standup
                <Icon name="arrow" size={16} />
              </button>
            </div>
            <section className={styles["section"]}>
              <div className={styles["section-heading"]}>
                <div>
                  <h2 className={styles["native-h2"]}>
                    Your projects{" "}
                    <span className={styles["count"]}>
                      {data.projects.length}
                    </span>
                  </h2>
                  <p className={styles["native-p"]}>
                    A clear path from idea to done.
                  </p>
                </div>
                {workspace && (
                  <Link
                    className={cx(styles["native-a"], styles["text-link"])}
                    href={`/workspaces/${workspace.id}`}
                  >
                    View all <Icon name="arrow" size={15} />
                  </Link>
                )}
              </div>
              {data.projects.length ? (
                <div className={styles["projects-grid"]}>
                  {data.projects.slice(0, 3).map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onNavigate={onProjectNavigate}
                    />
                  ))}
                  <button
                    className={cx(
                      styles["native-button"],
                      styles["new-project-card"],
                    )}
                    onClick={() =>
                      workspace ? setCreateProject(true) : onCreateWorkspace()
                    }
                  >
                    <span>
                      <Icon name="plus" size={24} />
                    </span>
                    <strong>Create a project</strong>
                    <small>Big ideas start here</small>
                  </button>
                </div>
              ) : (
                <div className={styles["panel"]}>
                  <Empty
                    title={
                      workspaces.length
                        ? "Your next project starts here"
                        : "First, make yourself at home"
                    }
                    description={
                      workspaces.length
                        ? "Create a project, add a few tasks, and give your team a clear next step."
                        : "Create your first workspace to bring your projects and people together."
                    }
                  >
                    <button
                      className={cx(
                        styles["native-button"],
                        styles["button"],
                        styles["primary"],
                      )}
                      onClick={() =>
                        workspace ? setCreateProject(true) : onCreateWorkspace()
                      }
                    >
                      <Icon name="plus" size={17} />
                      {workspace ? "Create project" : "Create workspace"}
                    </button>
                  </Empty>
                </div>
              )}
            </section>
            <div className={styles["dashboard-lower"]}>
              <section className={styles["panel"]}>
                <div className={styles["panel-heading"]}>
                  <h2 className={styles["native-h2"]}>Recent tasks</h2>
                  <span className={styles["subtle-badge"]}>Latest updates</span>
                </div>
                {data.recentTasks.length ? (
                  <div>
                    {data.recentTasks.slice(0, 7).map((task) => (
                      <Link
                        className={cx(styles["native-a"], styles["task-row"])}
                        key={task.id}
                        href={`/projects/${task.projectId}?task=${task.id}`}
                        onNavigate={() => {
                          const project = data.projects.find(
                            (project) => project.id === task.projectId,
                          );
                          if (project) onProjectNavigate(project);
                        }}
                      >
                        <span className={styles["task-checkbox"]}>
                          <Icon name="circle" size={16} />
                        </span>
                        <div>
                          <strong>{task.title}</strong>
                          <span>
                            {task.project?.name || "Project task"}
                            {task.column?.name ? ` · ${task.column.name}` : ""}
                          </span>
                        </div>
                        <PriorityBadge
                          priority={task.priority}
                          className={styles.taskPriority}
                        />
                        <span className={styles["table-date"]}>
                          {task.dueDate ? dateLabel(task.dueDate) : "—"}
                        </span>
                        {task.assignee && (
                          <Avatar
                            name={task.assignee.name}
                            size="small"
                            className={styles.taskAssignee}
                          />
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon="board"
                    title="A fresh start"
                    description="Add tasks to a project and your latest work will appear here."
                  />
                )}
              </section>
              <section
                className={cx(styles["panel"], styles["activity-panel"])}
              >
                <div className={styles["panel-heading"]}>
                  <h2 className={styles["native-h2"]}>Team activity</h2>
                  <Icon name="activity" size={18} />
                </div>
                {data.recentActivity.length ? (
                  <div className={styles["activity-list"]}>
                    {data.recentActivity.slice(0, 7).map((activity) => (
                      <div
                        className={styles["activity-item"]}
                        key={activity.id}
                      >
                        <Avatar
                          name={
                            activity.actor?.name ||
                            activity.user?.name ||
                            "Team"
                          }
                          size="small"
                        />
                        <div>
                          <p className={styles["native-p"]}>
                            {activity.description ||
                              `${activity.actor?.name || activity.user?.name || "A teammate"} ${activity.action.toLowerCase().replace(/[_.]/g, " ")}${activity.entityName ? ` ${activity.entityName}` : ""}`}
                          </p>
                          <span className={styles.activityTime}>
                            {timeAgo(activity.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon="activity"
                    className={styles.activityEmpty}
                    title="Quiet for now"
                    description="Updates from your team will show up here."
                  />
                )}
              </section>
            </div>
          </>
        )
      )}
      {createProject && workspace && (
        <ProjectEditor
          workspaceId={workspace.id}
          onClose={() => setCreateProject(false)}
          onSave={(project) => {
            setCreateProject(false);
            onChange();
            onProjectNavigate(project);
            router.push(`/projects/${project.id}`);
          }}
        />
      )}
      {ai && workspace && (
        <AiPanel
          type="standup"
          workspaceId={workspace.id}
          onClose={() => setAi(false)}
        />
      )}
    </>
  );
}
