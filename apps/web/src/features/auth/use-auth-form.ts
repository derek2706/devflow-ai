"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { errorText, post } from "../../lib/api";
import type { User } from "../../lib/types";

export function useAuthForm(path: string, onLogin: (user: User) => void) {
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
  return {
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
  };
}
