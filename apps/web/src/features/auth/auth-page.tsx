"use client";
import styles from "./auth.module.css";
import type { User } from "../../lib/types";
import { AuthStory } from "./auth-story";
import { AuthForm } from "./auth-form";
import { useAuthForm } from "./use-auth-form";

export function Auth({
  path,
  onLogin,
}: {
  path: string;
  onLogin: (user: User) => void;
}) {
  const form = useAuthForm(path, onLogin);
  return (
    <div className={styles["auth-page"]}>
      <AuthStory />
      <AuthForm {...form} />
    </div>
  );
}
