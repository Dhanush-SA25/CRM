import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

const CHECK_INTERVAL_MS = 30000;

/**
 * Periodically pings the backend health endpoint so the UI can show whether
 * every API call has a live target. Returns "checking" | "online" | "offline".
 */
export function useServerStatus() {
  const [status, setStatus] = useState("checking");
  const [lastChecked, setLastChecked] = useState(null);

  const check = useCallback(async () => {
    try {
      await api.get("/health", { timeout: 4000 });
      setStatus("online");
    } catch {
      setStatus("offline");
    } finally {
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const handleOnline = () => check();
    const handleOffline = () => setStatus("offline");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [check]);

  return { status, lastChecked, recheck: check };
}
