import { useEffect, useRef } from "react";
import { AppState } from "react-native";

type AutoRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  runOnMount?: boolean;
};

export function useAutoRefresh(
  refreshFn: () => Promise<void> | void,
  options: AutoRefreshOptions = {}
) {
  const { enabled = true, intervalMs = 30000, runOnMount = false } = options;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const executeRefresh = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await refreshFn();
      } finally {
        inFlightRef.current = false;
      }
    };

    if (runOnMount) {
      executeRefresh();
    }

    const intervalId = setInterval(executeRefresh, intervalMs);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        executeRefresh();
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [enabled, intervalMs, runOnMount, refreshFn]);
}

