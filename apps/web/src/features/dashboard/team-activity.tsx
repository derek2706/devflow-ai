"use client";
import styles from "./dashboard.module.css";
import { cx } from "../../lib/class-names";
import type { Activity } from "../../lib/types";
import { Avatar } from "../../components/ui/avatar";
import { Empty } from "../../components/ui/empty";
import { Icon } from "../../components/ui/icon";
import { timeAgo } from "../../lib/format-date";
export function TeamActivity({ activities }: { activities: Activity[] }) {
  return (
    <section className={cx(styles["panel"], styles["activity-panel"])}>
      <div className={styles["panel-heading"]}>
        <h2 className={styles["native-h2"]}>Team activity</h2>
        <Icon name="activity" size={18} />
      </div>
      {activities.length ? (
        <div className={styles["activity-list"]}>
          {activities.slice(0, 7).map((activity) => (
            <div className={styles["activity-item"]} key={activity.id}>
              <Avatar
                name={activity.actor?.name || activity.user?.name || "Team"}
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
  );
}
