import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type ConnectivityStatus = "online" | "offline" | "server-down";

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>(() => 
    typeof window !== "undefined" && window.navigator.onLine ? "online" : "offline"
  );
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<Date | null>(null);

  const checkServerStatus = useCallback(async () => {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      setStatus("offline");
      return;
    }

    setIsChecking(true);
    try {
      if (!supabase) {
        setStatus("server-down");
        return;
      }

      // Smallest possible query to check DB availability
      const { error } = await supabase.from("app_settings").select("key").limit(1);
      
      if (error) {
        // If it's a network error (not a Postgres error like 404 or something logic-related)
        if (error.message.toLowerCase().includes("failed to fetch") || error.code === "PGRST301") {
          setStatus("server-down");
        } else {
          // It's connected but maybe table doesn't exist? Still technically "online"
          setStatus("online");
        }
      } else {
        setStatus("online");
      }
    } catch (err) {
      setStatus("server-down");
    } finally {
      setIsChecking(false);
      setLastCheckAt(new Date());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setStatus("online");
      void checkServerStatus();
    };
    
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    void checkServerStatus();

    // Periodic check every 30 seconds if online
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkServerStatus();
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [checkServerStatus]);

  return {
    status,
    isOnline: status === "online",
    isOffline: status === "offline",
    isServerDown: status === "server-down",
    isChecking,
    lastCheckAt,
    refresh: checkServerStatus,
  };
}

