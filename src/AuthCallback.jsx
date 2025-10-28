// src/AuthCallback.jsx
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AuthCallback() {
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Optionally store session locally if needed
        console.log('Session restored:', session)
      }
    }
    checkSession()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen p-6">
      <h1 className="text-xl font-bold mb-4">✅ Logged in!</h1>
      <p className="text-center">
        You can now return to the PWA to continue using the shopping list.
      </p>
      <p className="text-sm mt-2 text-gray-500">
        On iOS, tap the PWA icon to switch back.
      </p>
      <button
        className="mt-6 bg-customGreen text-white px-6 py-2 rounded"
        onClick={() => window.close()} // attempts to close Safari tab
      >
        Return to App
      </button>
    </div>
  )
}
