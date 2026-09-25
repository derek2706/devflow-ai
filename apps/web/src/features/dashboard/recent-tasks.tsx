"use client";
import styles from "./dashboard.module.css";
import Link from "next/link";
import { cx } from "../../lib/class-names";
import type { Task } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { dateLabel } from "../../lib/format-date";
import { Empty } from "../../components/ui/empty";
import { Icon } from "../../components/ui/icon";
import { PriorityBadge } from "../../components/ui/priority-badge";
export function RecentTasks({
  tasks,
  onTaskNavigate,
}: {
  tasks: Task[];
  onTaskNavigate: (projectId: string) => void;
}) {
  return (
    <section className={styles["panel"]}>
      <div className={styles["panel-heading"]}>
        <h2 className={styles["native-h2"]}>Recent tasks</h2>
        <span className={styles["subtle-badge"]}>Latest updates</span>
      </div>
      {tasks.length ? (
        <div>
          {tasks.slice(0, 7).map((task) => (
            <Link
              className={cx(styles["native-a"], styles["task-row"])}
              key={task.id}
              href={`/projects/${task.projectId}?task=${task.id}`}
              onNavigate={() => onTaskNavigate(task.projectId)}
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
  );
}
