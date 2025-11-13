// src/useOfflineQueue.js
import { useCallback, useEffect } from "react";
import localforage from "localforage";
import useOfflineStatus from "./useOfflineStatus";

localforage.config({
  name: "shoppinglist-offline",
  storeName: "queuedActions",
});

export default function useOfflineQueue(supabase) {
  const isOnline = useOfflineStatus();

  // Flush queue when back online
  const flushQueue = useCallback(async () => {
    const queue = (await localforage.getItem("queue")) || [];
    if (queue.length === 0) return;

    console.log("📤 Flushing offline queue:", queue);

    const remaining = [];

    for (const action of queue) {
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
        console.warn("⚠ Supabase still failing, keeping in queue:", err);
        remaining.push(action);
      }
    }

    await localforage.setItem("queue", remaining);
  }, [supabase]);

  // Try flushing when browser reports online
  useEffect(() => {
    if (isOnline) {
      flushQueue();
    }
  }, [isOnline, flushQueue]);


  // Main queueAction function
  const queueAction = useCallback(
    async ({ table, type, data, match }) => {
      const addToQueue = async () => {
        const q = (await localforage.getItem("queue")) || [];
        q.push({ table, type, data, match });
        await localforage.setItem("queue", q);
        console.log("📦 Action queued:", { table, type, data, match });
      };

      // If browser already reports offline → instantly queue
      if (!isOnline) {
        await addToQueue();
        return;
      }

      // Try doing it online
      try {
        if (type === "insert") {
          await supabase.from(table).insert(data);
        } else if (type === "update") {
          await supabase.from(table).update(data).match(match);
        } else if (type === "delete") {
          await supabase.from(table).delete().match(match);
        }
      } catch (err) {
        console.log("❌ Network/Supabase error, queueing:", err);

        // Only treat fetch/connection errors as offline
        if (err.message.includes("Failed to fetch")) {
          console.log("🔌 Switching to offline mode.");
        }

        await addToQueue();
      }
    },
    [supabase, isOnline]
  );

  return { isOnline, queueAction };
}
