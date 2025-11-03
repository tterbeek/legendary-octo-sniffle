// src/useOfflineQueue.js
import { useEffect, useState, useCallback } from 'react'
import localforage from 'localforage'

localforage.config({
  name: 'shoppinglist-offline-queue',
  storeName: 'supabaseActions'
})

export default function useOfflineQueue(supabase) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Listen to connection changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Helper to flush queue
  const flushQueue = useCallback(async () => {
    const queued = (await localforage.getItem('queue')) || []
    if (!queued.length) return

    const remaining = []
    for (const action of queued) {
      try {
        const { table, type, data, match } = action
        if (type === 'insert') {
          await supabase.from(table).insert(data)
        } else if (type === 'update') {
          await supabase.from(table).update(data).match(match)
        } else if (type === 'delete') {
          await supabase.from(table).delete().match(match)
        }
      } catch (err) {
        console.error('Failed to replay action', action, err)
        remaining.push(action)
      }
    }
    await localforage.setItem('queue', remaining)
  }, [supabase])

  // Replay queued actions when back online
  useEffect(() => {
    if (isOnline) flushQueue()
  }, [isOnline, flushQueue])

  // Main API to use in components
  const queueAction = useCallback(
    async ({ table, type, data, match }) => {
      try {
        if (!isOnline) throw new Error('Offline')
        if (type === 'insert') {
          await supabase.from(table).insert(data)
        } else if (type === 'update') {
          await supabase.from(table).update(data).match(match)
        } else if (type === 'delete') {
          await supabase.from(table).delete().match(match)
        }
      } catch (err) {
        // Save for later
        const queued = (await localforage.getItem('queue')) || []
        queued.push({ table, type, data, match })
        await localforage.setItem('queue', queued)
        console.warn('Action queued for later sync', { table, type, data })
      }
    },
    [isOnline, supabase]
  )

  return { isOnline, queueAction }
}
