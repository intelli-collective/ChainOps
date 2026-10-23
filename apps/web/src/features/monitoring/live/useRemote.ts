import { useCallback, useEffect, useState } from "react";
import { monitoringApi } from "./api";

export function useRemote<T>(path: string, poll = false) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    data?: T;
    error?: Error;
  }>();
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      monitoringApi.request<T>(path, "GET", undefined, controller.signal).then(
        (data) => {
          if (!controller.signal.aborted) setResult({ path, data });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult((previous) => ({
              path,
              data: previous?.path === path ? previous.data : undefined,
              error:
                error instanceof Error
                  ? error
                  : new Error("Unable to load monitoring"),
            }));
        },
      );
    void load();
    const timer = poll
      ? window.setInterval(() => {
          if (document.visibilityState !== "hidden") void load();
        }, 10000)
      : undefined;
    return () => {
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
  }, [path, poll, attempt]);
  const current = result?.path === path ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    refresh,
  };
}
