"use client";
import styles from "./auth.module.css";
import { cx } from "../lib/class-names";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { errorText, post } from "../lib/api";
import { User } from "../lib/types";
import { ErrorBanner, Icon, Logo, SuccessBanner } from "./ui";

export function Auth({
  path,
  onLogin,
}: {
  path: string;
  onLogin: (user: User) => void;
}) {
  const router = useRouter();
  const signup = path === "/signup";
  const forgot = path === "/forgot-password";
  const reset = path === "/reset-password";
  const [identifier, setIdentifier] = useState<"email" | "mobileNumber">(
    "email",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      if (forgot) {
        await post("/auth/forgot-password", { email: form.get("email") });
        setSuccess(
          "If an account exists for that email, a password reset link is on its way. Check your inbox.",
        );
      } else if (reset) {
        const token = new URLSearchParams(window.location.search).get("token");
        if (!token)
          throw new Error(
            "This reset link is missing its token. Request a new link.",
          );
        await post("/auth/reset-password", {
          token,
          password: form.get("password"),
        });
        setSuccess("Your password has been updated. You can sign in now.");
      } else {
        const result = await post<{ user: User }>(
          signup ? "/auth/register" : "/auth/login",
          {
            [identifier]: form.get(identifier),
            password: form.get("password"),
            ...(signup ? { name: form.get("name") } : {}),
          },
        );
        onLogin(result.user);
        const redirect = new URLSearchParams(window.location.search).get(
          "next",
        );
        router.push(redirect?.startsWith("/invite?") ? redirect : "/dashboard");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() =>
      setNext(new URLSearchParams(window.location.search).get("next")),
    );
  }, []);
  const withNext = (url: string) =>
    next?.startsWith("/invite?")
      ? `${url}?next=${encodeURIComponent(next)}`
      : url;
  return (
    <div className={styles["auth-page"]}>
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
                  className={cx(
                    styles["illustration-card"],
                    styles["elevated"],
                  )}
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
                    Password recovery and email invitations require an
                    email-based account.
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
    </div>
  );
}
