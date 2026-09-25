"use client";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, errorText } from "../lib/api";
import { SessionExpiredContext } from "../contexts/session-context";

export function useResource<T>(path: string | null) {
  const onSessionExpired = useContext(SessionExpiredContext);
  const [revision, setRevision] = useState(0);
  // A new request identity prevents a previous visit's error/loading state from
  // flashing when a resource changes from A to B and back to A.
  const request = useMemo(() => ({ path, revision }), [path, revision]);
  const [state, setState] = useState<{
    request?: typeof request;
    data?: T;
    error?: string;
  }>({});
  useEffect(() => {
    const controller = new AbortController();
    if (!path) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setState({});
      });
      return () => controller.abort();
    }
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ request, data });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired?.();
        setState({ request, error: errorText(error) });
      });
    return () => controller.abort();
  }, [path, request, onSessionExpired]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return {
    data: path && state.request?.path === path ? state.data : undefined,
    error: state.request === request ? state.error : undefined,
    loading: !!path && state.request !== request,
    refresh,
  };
}
