// src/useOfflineQueue.js
import { useEffect, useState, useCallback } from 'react'
import localforage from 'localforage'

localforage.config({
  name: 'shoppinglist-offline-queue',
  storeName: 'supabaseActions'
})

export default function useOfflineQueue(supabase) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // ----------------------------------------------------
  // 1️⃣ Reliable online/offline detection
  //    Combines browser events + WebView-safe heartbeat
  // ----------------------------------------------------
  useEffect(() => {
    const setOffline = () => setIsOnline(false)
    const setOnline = () => setIsOnline(true)

    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)

    const heartbeat = async () => {
      try {
        // This URL is used by Android OS to check internet reachable
        await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          cache: 'no-cache'
        })
        setIsOnline(true)
      } catch {
        setIsOnline(false)
      }
    }

    // Check connectivity immediately and every 8s
    heartbeat()
    const interval = setInterval(heartbeat, 8000)

    return () => {
      window.removeEventListener('online', setOnline)
      window.removeEventListener('offline', setOffline)
      clearInterval(interval)
    }
  }, [])

  // ----------------------------------------------------
  // 2️⃣ Queue flusher
  // ----------------------------------------------------
  const flushQueue = useCallback(async () => {
    const queued = (await localforage.getItem('queue')) || []
    if (!queued.length) return

    console.log('Flushing queued actions:', queued)

    const remaining = []
    for (const action of queued) {
      try {
        const { table, type, data, match } = action

        if (type === 'insert')
          await supabase.from(table).insert(data)
        else if (type === 'update')
          await supabase.from(table).update(data).match(match)
        else if (type === 'delete')
          await supabase.from(table).delete().match(match)

      } catch (err) {
        console.warn('Failed to replay action, keeping in queue:', action, err)
        remaining.push(action)
      }
    }

    await localforage.setItem('queue', remaining)
  }, [supabase])

  // ----------------------------------------------------
  // 3️⃣ Flush queue when online
  // ----------------------------------------------------
  useEffect(() => {
    if (isOnline) {
      console.log('Back online → flushing queue')
      flushQueue()
    }
  }, [isOnline, flushQueue])

  // ----------------------------------------------------
  // 4️⃣ queueAction API (write-through with fallback)
  // ----------------------------------------------------
  const queueAction = useCallback(
    async ({ table, type, data, match }) => {
      if (!isOnline) {
        const queued = (await localforage.getItem('queue')) || []
        queued.push({ table, type, data, match })
        await localforage.setItem('queue', queued)

        console.warn('Offline → action queued:', { table, type, data })
        return
      }

      // We are online — try immediate Supabase call
      try {
        if (type === 'insert')
          await supabase.from(table).insert(data)
        else if (type === 'update')
          await supabase.from(table).update(data).match(match)
        else if (type === 'delete')
          await supabase.from(table).delete().match(match)
      } catch (err) {
        // If call fails, queue it
        console.error('Supabase call failed → queued:', err)
        const queued = (await localforage.getItem('queue')) || []
        queued.push({ table, type, data, match })
        await localforage.setItem('queue', queued)
      }
    },
    [isOnline, supabase]
  )

  return { isOnline, queueAction }
}
