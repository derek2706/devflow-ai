import styles from "./layout.module.css";
import { cx } from "../../lib/class-names";
import { Logo } from "../ui/logo";
import { ErrorBanner } from "../ui/feedback";
import { Loading } from "../ui/loading";

export function SessionLoading({
  authError,
  onRetry,
}: {
  authError: string;
  onRetry: () => void;
}) {
  return (
    <main className={styles["boot"]}>
      <Logo />
      {authError ? (
        <>
          <ErrorBanner error={authError} className={styles["bootNotice"]} />
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
            )}
            onClick={onRetry}
          >
            Try again
          </button>
        </>
      ) : (
        <Loading
          label="Getting things ready…"
          className={styles["bootLoading"]}
        />
      )}
    </main>
  );
}
