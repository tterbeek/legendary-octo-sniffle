// src/useSmartOnlineStatus.js
import { useEffect, useState, useRef } from "react"

export default function useSmartOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const cooldownRef = useRef(null)

  // --- When ANY Supabase request fails, we call this ---
  const forceOffline = () => {
    setIsOnline(false)

    // Stay offline minimum 20s to avoid flapping in weak signal areas
    if (cooldownRef.current) clearTimeout(cooldownRef.current)
    cooldownRef.current = setTimeout(() => {
      // Allow online mode again
      setIsOnline(navigator.onLine)
    }, 20000)
  }

  // Listen for REAL online/offline events (desktop)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)

    window.addEventListener("online", on)
    window.addEventListener("offline", off)

    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  return { isOnline, forceOffline }
}
