import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/api";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.onLine === false) {
        setIsOnline(false);
        return;
      }
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/health`, { method: "GET" });
        if (active) setIsOnline(response.ok);
      } catch {
        if (active) setIsOnline(false);
      }
    };
    const interval = setInterval(check, 20_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    const onOnline = () => void check();
    const onOffline = () => setIsOnline(false);
    if (Platform.OS === "web") {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }
    void check();
    return () => {
      active = false;
      clearInterval(interval);
      appState.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, []);
  return isOnline;
}
