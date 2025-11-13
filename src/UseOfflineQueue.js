import { useEffect, useState, useCallback } from "react";
import localforage from "localforage";

localforage.config({
  name: "shoppinglist-offline-queue",
  storeName: "supabaseActions",
});

export default function useOfflineQueue(supabase) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // -------------------------------------------------------
  // 1️⃣ ONLINE DETECTION:
  //    Browser events + WebView fallback heartbeat
  // -------------------------------------------------------
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 🔥 Mobile WebView fallback:
    // Tries to fetch Google's 204 endpoint.
    const checkConnection = () => {
      fetch("https://www.google.com/generate_204", { method: "HEAD" })
        .then(() => setIsOnline(true))
        .catch(() => setIsOnline(false));
    };

    // Check immediately and every 5 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // -------------------------------------------------------
  // 2️⃣ FLUSH QUEUE WHEN ONLINE
  // -------------------------------------------------------
  const flushQueue = useCallback(async () => {
    const queued = (await localforage.getItem("queue")) || [];
    if (!queued.length) return;

    console.log("📤 Flushing queued actions:", queued);

    const remaining = [];

    for (const action of queued) {
      const { table, type, data, match } = action;

      try {
        if (type === "insert") {
          await supabase.from(table).insert(data);
        } else if (type === "update") {
          await supabase.from(table).update(data).match(match);
        } else if (type === "delete") {
          await supabase.from(table).delete().match(match);
        }
      } catch (err) {
        console.warn("⚠️ Failed to replay action → keeping in queue:", err);
        remaining.push(action);
      }
    }

    await localforage.setItem("queue", remaining);
  }, [supabase]);

  useEffect(() => {
    if (isOnline) {
      flushQueue();
    }
  }, [isOnline, flushQueue]);

  // -------------------------------------------------------
  // 3️⃣ QUEUE ACTION (write-through)
  // -------------------------------------------------------
  const queueAction = useCallback(
    async ({ table, type, data, match }) => {
      const enqueue = async () => {
        const queued = (await localforage.getItem("queue")) || [];
        queued.push({ table, type, data, match });
        await localforage.setItem("queue", queued);
        console.warn("📦 Queued action:", { table, type, data, match });
      };

      if (!isOnline) {
        return enqueue();
      }

      try {
        if (type === "insert") {
          await supabase.from(table).insert(data);
        } else if (type === "update") {
          await supabase.from(table).update(data).match(match);
        } else if (type === "delete") {
          await supabase.from(table).delete().match(match);
        }
      } catch (err) {
        console.error("❌ Supabase write failed → queuing:", err);

        // If WebView silently dropped connection
        if (!navigator.onLine || err.message === "Failed to fetch") {
          setIsOnline(false);
        }

        await enqueue();
      }
    },
    [isOnline, supabase]
  );

  return { isOnline, queueAction };
}
