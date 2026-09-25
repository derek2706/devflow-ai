"use client";
import styles from "./auth.module.css";
import { cx } from "../../lib/class-names";
import Link from "next/link";
import { Icon } from "../../components/ui/icon";
import { Logo } from "../../components/ui/logo";
import { ErrorBanner, SuccessBanner } from "../../components/ui/feedback";
import type { useAuthForm } from "./use-auth-form";

export function AuthForm({
  signup,
  forgot,
  reset,
  identifier,
  setIdentifier,
  busy,
  error,
  success,
  submit,
  withNext,
}: ReturnType<typeof useAuthForm>) {
  return (
    <main className={styles["auth-main"]}>
      <div className={styles["auth-mobile-logo"]}>
        <Logo />
      </div>
      <div className={styles["auth-form"]}>
        <span className={styles["eyebrow"]}>YOUR WORK, IN SYNC</span>
        <h2 className={styles["native-h2"]}>
          {signup
            ? "Start your next chapter"
            : forgot
              ? "Find your way back"
              : reset
                ? "A fresh start"
                : "Welcome back"}
        </h2>
        <p className={styles["native-p"]}>
          {signup
            ? "Create your account and get into the flow."
            : forgot
              ? "We'll send you a link to reset your password."
              : reset
                ? "Choose a strong new password for your account."
                : "Good to see you. Let's make progress."}
        </p>
        <ErrorBanner error={error} />
        <SuccessBanner message={success} />
        <form onSubmit={submit} className={styles["form-stack"]}>
          {signup && (
            <label className={styles["native-label"]}>
              Full name
              <input
                className={styles["native-input"]}
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                placeholder="Alex Morgan"
                required
              />
            </label>
          )}
          {!forgot && !reset && (
            <div
              className={styles["auth-identifiers"]}
              role="group"
              aria-label="Sign in method"
            >
              <button
                type="button"
                className={cx(
                  styles["native-button"],
                  identifier === "email" ? styles["selected"] : undefined,
                )}
                aria-pressed={identifier === "email"}
                onClick={() => setIdentifier("email")}
              >
                Email
              </button>
              <button
                type="button"
                className={cx(
                  styles["native-button"],
                  identifier === "mobileNumber"
                    ? styles["selected"]
                    : undefined,
                )}
                aria-pressed={identifier === "mobileNumber"}
                onClick={() => setIdentifier("mobileNumber")}
              >
                Mobile
              </button>
            </div>
          )}
          {!reset &&
            (forgot || identifier === "email" ? (
              <label className={styles["native-label"]}>
                Email address
                <input
                  className={styles["native-input"]}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                />
              </label>
            ) : (
              <label className={styles["native-label"]}>
                Mobile number
                <input
                  className={styles["native-input"]}
                  name="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit Indian mobile number"
                  pattern="[6-9][0-9]{9}"
                  title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9"
                  minLength={10}
                  maxLength={10}
                  required
                />
                <span className={styles["helper"]}>
                  Password recovery and email invitations require an email-based
                  account.
                </span>
              </label>
            ))}
          {!forgot && (
            <label className={styles["native-label"]}>
              {reset ? "New password" : "Password"}
              <input
                className={styles["native-input"]}
                name="password"
                type="password"
                autoComplete={
                  signup || reset ? "new-password" : "current-password"
                }
                minLength={signup || reset ? 8 : 1}
                maxLength={72}
                placeholder={
                  signup || reset
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                required
              />
            </label>
          )}
          {!signup && !forgot && !reset && (
            <div className={cx(styles["form-inline"], styles["end"])}>
              <Link
                href="/forgot-password"
                className={cx(styles["native-a"], styles["text-link"])}
              >
                Forgot password?
              </Link>
            </div>
          )}
          <button
            className={cx(
              styles["native-button"],
              styles["button"],
              styles["primary"],
              styles["full"],
            )}
            disabled={busy}
          >
            {busy
              ? "One moment…"
              : signup
                ? "Create account"
                : forgot
                  ? "Send reset link"
                  : reset
                    ? "Reset password"
                    : "Sign in"}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <p className={cx(styles["native-p"], styles["auth-switch"])}>
          {forgot || reset ? (
            <Link
              className={cx(styles["native-a"], styles["text-link"])}
              href="/login"
            >
              Back to sign in
            </Link>
          ) : signup ? (
            <>
              Already have an account?{" "}
              <Link
                className={cx(styles["native-a"], styles["text-link"])}
                href={withNext("/login")}
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to DevFlow?{" "}
              <Link
                className={cx(styles["native-a"], styles["text-link"])}
                href={withNext("/signup")}
              >
                Create an account
              </Link>
            </>
          )}
        </p>
        <div className={styles["auth-note"]}>
          <Icon name="board" size={17} />
          Your next great project starts here.
        </div>
      </div>
    </main>
  );
}
