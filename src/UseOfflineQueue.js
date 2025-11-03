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

  console.log('Flushing queued actions:', queued)

  const remaining = []
  for (const action of queued) {
    try {
      const { table, type, data, match } = action
      if (type === 'insert') await supabase.from(table).insert(data)
      else if (type === 'update') await supabase.from(table).update(data).match(match)
      else if (type === 'delete') await supabase.from(table).delete().match(match)
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
    if (!isOnline) {
      // If offline, immediately queue the action
      const queued = (await localforage.getItem('queue')) || []
      queued.push({ table, type, data, match })
      await localforage.setItem('queue', queued)
      console.warn('Queuing action offline for later sync', { table, type, data })
      return
    }

    try {
      console.log('Sending to Supabase:', { table, type, data, match })

      // Perform actual Supabase operation
      if (type === 'insert') {
        await supabase.from(table).insert(data)
      } else if (type === 'update') {
        await supabase.from(table).update(data).match(match)
      } else if (type === 'delete') {
        await supabase.from(table).delete().match(match)
      }
    } catch (err) {
      console.error('Error during Supabase operation:', err)
      const queued = (await localforage.getItem('queue')) || []
      queued.push({ table, type, data, match })
      await localforage.setItem('queue', queued)
      console.warn('Queuing failed action for later sync', { table, type, data })
    }
  },
  [isOnline, supabase]
)

  return { isOnline, queueAction }
}
