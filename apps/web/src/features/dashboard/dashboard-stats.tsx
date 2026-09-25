"use client";

import { cx } from "../../lib/class-names";
import type { DashboardData } from "../../lib/types";
import { Icon } from "../../components/ui/icon";
import styles from "./dashboard.module.css";

type StatColor = "purple" | "blue" | "green" | "orange";

export interface DashboardStatCardProps {
  label: string;
  value: number;
  icon: string;
  color: StatColor;
  description: string;
}

export function DashboardStatCard({
  label,
  value,
  icon,
  color,
  description,
}: DashboardStatCardProps) {
  return (
    <div className={styles["stat-card"]}>
      <div className={styles["stat-top"]}>
        <span>{label}</span>
        <span className={cx(styles["stat-icon"], styles[color])}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <strong>{value ?? 0}</strong>
      <small>{description}</small>
    </div>
  );
}

export function DashboardStats({ stats }: { stats: DashboardData["stats"] }) {
  const cards: DashboardStatCardProps[] = [
    {
      label: "Total projects",
      value: stats.projects,
      icon: "folder",
      color: "purple",
      description: "Ideas in motion",
    },
    {
      label: "Open tasks",
      value: Math.max(0, stats.tasks - stats.completedTasks),
      icon: "board",
      color: "blue",
      description: "One step at a time",
    },
    {
      label: "Completed",
      value: stats.completedTasks,
      icon: "check",
      color: "green",
      description: "Progress worth celebrating",
    },
    {
      label: "Overdue tasks",
      value: stats.overdueTasks,
      icon: "clock",
      color: "orange",
      description: "A little attention needed",
    },
  ];

  return (
    <div className={styles["stats-grid"]}>
      {cards.map((card) => (
        <DashboardStatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
