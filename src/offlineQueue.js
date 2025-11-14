// src/offlineQueue.js
import localforage from "localforage"

localforage.config({
  name: "shoppinglist",
  storeName: "offlineQueue",
})

// Add entry to the queue
async function enqueue(action) {
  const q = (await localforage.getItem("queue")) || []
  q.push(action)
  await localforage.setItem("queue", q)
}

// Flush queue (called when online)
export async function flushQueue(supabase) {
  const q = (await localforage.getItem("queue")) || []
  if (q.length === 0) return

  const remaining = []

  for (const a of q) {
    try {
      if (a.type === "insert") {
        await supabase.from(a.table).insert(a.data)
      } else if (a.type === "update") {
        await supabase.from(a.table).update(a.data).match(a.match)
      } else if (a.type === "delete") {
        await supabase.from(a.table).delete().match(a.match)
      }
    } catch (err) {
      // keep failed actions for later
      remaining.push(a)
    }
  }

  await localforage.setItem("queue", remaining)
}

// Queue wrapper: attempt Supabase → fallback offline
export async function queueAction(action, supabase, forceOffline) {
  try {
    // If browser already thinks we are offline → queue immediately
    if (!navigator.onLine) {
      await enqueue(action)
      forceOffline()
      return
    }

    // Try to do the operation online
    const { type, table, data, match } = action

    if (type === "insert") {
      await supabase.from(table).insert(data)
    } else if (type === "update") {
      await supabase.from(table).update(data).match(match)
    } else if (type === "delete") {
      await supabase.from(table).delete().match(match)
    }

  } catch (err) {
    // ANY failure signals we’re basically offline (WebView)
    await enqueue(action)
    forceOffline()
  }
}
