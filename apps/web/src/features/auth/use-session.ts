"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, errorText, post } from "../../lib/api";
import type { User } from "../../lib/types";

export function useSession() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);
  const [user, setUser] = useState<User | null>();
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const clearSession = useCallback(() => {
    setUser(null);
    setAuthError("");
  }, []);
  const signIn = useCallback((nextUser: User) => {
    setUser(nextUser);
    setAuthError("");
  }, []);
  useEffect(() => {
    if (isPublic || user !== undefined) return;
    const controller = new AbortController();
    api<{ user: User }>("/auth/me", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setUser(data.user);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        } else setAuthError(errorText(error));
      });
    return () => controller.abort();
  }, [isPublic, user, attempt, clearSession]);
  useEffect(() => {
    if (isPublic || user !== null) return;
    const next =
      pathname === "/invite"
        ? `?next=${encodeURIComponent(pathname + window.location.search)}`
        : "";
    router.replace(`/login${next}`);
  }, [isPublic, user, pathname, router]);
  async function logout() {
    try {
      await post("/auth/logout");
      clearSession();
      router.replace("/login");
    } catch (error) {
      setAuthError(errorText(error));
    }
  }
  return {
    pathname,
    isPublic,
    user,
    authError,
    clearSession,
    signIn,
    logout,
    retry: () => {
      setAuthError("");
      setAttempt((value) => value + 1);
    },
  };
}
