"use client";
import { Auth } from "../features/auth/auth-page";
import { useSession } from "../features/auth/use-session";
import { SessionExpiredContext } from "../contexts/session-context";
import { AuthenticatedApp } from "./layout/authenticated-app";
import { SessionLoading } from "./layout/session-loading";

export function DevFlow() {
  const {
    pathname,
    isPublic,
    user,
    authError,
    clearSession,
    signIn,
    logout,
    retry,
  } = useSession();
  if (isPublic || user === null)
    return (
      <Auth
        key={pathname}
        path={isPublic ? pathname : "/login"}
        onLogin={signIn}
      />
    );
  if (user === undefined)
    return <SessionLoading authError={authError} onRetry={retry} />;
  return (
    <SessionExpiredContext.Provider value={clearSession}>
      <AuthenticatedApp
        key={user.id}
        user={user}
        authError={authError}
        onLogout={logout}
      />
    </SessionExpiredContext.Provider>
  );
}
