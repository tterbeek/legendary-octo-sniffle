import { useState, useEffect } from 'react'          // <-- fix: import hooks
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login.jsx'
import ShoppingList from './ShoppingList.jsx'
import AuthCallback from './AuthCallback.jsx'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
    }
    initAuth()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div className="flex items-center justify-center min-h-screen">Loading...</div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={session ? <ShoppingList supabase={supabase} user={session.user} /> : <Navigate to="/login" replace />}
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}
