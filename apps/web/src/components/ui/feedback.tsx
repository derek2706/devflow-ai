import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";
import { Icon } from "./icon";

export function ErrorBanner({
  error,
  className,
}: {
  error?: string | null;
  className?: string;
}) {
  return error ? (
    <div
      className={cx(styles["notice"], styles["error"], className)}
      role="alert"
    >
      {error}
    </div>
  ) : null;
}
export function SuccessBanner({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  return message ? (
    <div
      className={cx(styles["notice"], styles["success"], className)}
      role="status"
    >
      <Icon name="check" size={17} />
      {message}
    </div>
  ) : null;
}
