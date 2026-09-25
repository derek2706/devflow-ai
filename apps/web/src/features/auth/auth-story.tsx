import styles from "./auth.module.css";
import { cx } from "../../lib/class-names";
import Link from "next/link";
import { Icon } from "../../components/ui/icon";
import { Logo } from "../../components/ui/logo";

export function AuthStory() {
  return (
    <div className={styles["auth-story"]}>
      <Link className={styles["native-a"]} href="/">
        <Logo className={styles["authLogo"]} />
      </Link>
      <div className={styles["auth-pitch"]}>
        <span className={styles["eyebrow"]}>
          <span className={styles["live-dot"]} />
          BUILT FOR THE WAY YOU BUILD
        </span>
        <h1 className={styles["native-h1"]}>
          Less busywork.
          <br />
          More <em>flow.</em>
        </h1>
        <p className={styles["native-p"]}>
          Bring your team, tasks, and next big idea together. Make space for
          work that matters.
        </p>
        <div className={styles["auth-illustration"]} aria-hidden="true">
          <div className={styles["illustration-header"]}>
            <span className={styles["project-glyph"]}>D</span>
            <div>
              <strong>Your next big idea</strong>
              <small>From first thought to shipped.</small>
            </div>
            <span className={styles["mini-dots"]}>•••</span>
          </div>
          <div className={styles["illustration-columns"]}>
            <div>
              <span>
                <i />
                To do
              </span>
              <div className={styles["illustration-card"]}>
                <span className={styles["mock-label"]}>DISCOVER</span>
                <b>Connect the dots</b>
                <div className={styles["mock-line"]} />
                <div className={cx(styles["mock-line"], styles["short"])} />
              </div>
            </div>
            <div>
              <span>
                <i />
                In progress
              </span>
              <div
                className={cx(styles["illustration-card"], styles["elevated"])}
              >
                <span className={cx(styles["mock-label"], styles["purple"])}>
                  BUILD
                </span>
                <b>Make something great</b>
                <div className={styles["mock-line"]} />
                <span className={styles["mock-avatar"]}>You</span>
              </div>
            </div>
            <div>
              <span>
                <i />
                Done
              </span>
              <div className={styles["illustration-card"]}>
                <span className={cx(styles["mock-label"], styles["green"])}>
                  SHIP
                </span>
                <b>Your next milestone</b>
                <span className={styles["mock-check"]}>
                  <Icon name="check" size={16} />
                  One step closer
                </span>
              </div>
            </div>
          </div>
          <div className={styles["illustration-ai"]}>
            <Icon name="sparkle" />
            <div>
              <strong>A little help. A lot of momentum.</strong>
              <small>Turn ideas into actionable next steps.</small>
            </div>
          </div>
        </div>
        <div className={styles["auth-values"]}>
          <span>
            <Icon name="check" size={16} /> One shared workspace
          </span>
          <span>
            <Icon name="check" size={16} /> AI that keeps you moving
          </span>
        </div>
      </div>
      <span className={styles["auth-footer"]}>
        Thoughtfully built for productive teams.
      </span>
    </div>
  );
}
