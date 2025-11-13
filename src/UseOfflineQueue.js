// src/useOfflineQueue.js
import { useEffect, useState, useCallback } from 'react'
import localforage from 'localforage'

localforage.config({
  name: 'shoppinglist-offline-queue',
  storeName: 'supabaseActions',
})

export default function useOfflineQueue(supabase) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // 1️⃣ Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🔵 Browser reports ONLINE')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('🔴 Browser reports OFFLINE')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 2️⃣ Flush queue helper
  const flushQueue = useCallback(async () => {
    const queued = (await localforage.getItem('queue')) || []
    if (!queued.length) return

    console.log('📤 Flushing queued actions:', queued)

    const remaining = []

    for (const action of queued) {
      const { table, type, data, match } = action

      try {
        if (type === 'insert') {
          await supabase.from(table).insert(data)
        } else if (type === 'update') {
          await supabase.from(table).update(data).match(match)
        } else if (type === 'delete') {
          await supabase.from(table).delete().match(match)
        }
      } catch (err) {
        console.warn('⚠️ Failed to replay action, keeping in queue:', action, err)
        remaining.push(action)
      }
    }

    await localforage.setItem('queue', remaining)
  }, [supabase])

  // 3️⃣ When we come online, try to flush queue
  useEffect(() => {
    if (isOnline) {
      flushQueue()
    }
  }, [isOnline, flushQueue])

  // 4️⃣ queueAction: write-through with offline fallback
  const queueAction = useCallback(
    async ({ table, type, data, match }) => {
      const enqueue = async () => {
        const queued = (await localforage.getItem('queue')) || []
        queued.push({ table, type, data, match })
        await localforage.setItem('queue', queued)
        console.warn('📦 Queued action for later:', { table, type, data, match })
      }

      // If browser already says offline → just queue
      if (!isOnline) {
        await enqueue()
        return
      }

      // Try Supabase immediately
      try {
        if (type === 'insert') {
          await supabase.from(table).insert(data)
        } else if (type === 'update') {
          await supabase.from(table).update(data).match(match)
        } else if (type === 'delete') {
          await supabase.from(table).delete().match(match)
        }
      } catch (err) {
        console.error('❌ Supabase operation failed, will queue:', err)

        // If it smells like a network error, treat as offline
        if (!navigator.onLine || err.message === 'Failed to fetch') {
          setIsOnline(false)
        }

        await enqueue()
      }
    },
    [isOnline, supabase]
  )

  return { isOnline, queueAction }
}
