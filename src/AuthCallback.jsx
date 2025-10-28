import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase automatically handles the session from the URL fragment
    const handleAuth = async () => {
      await supabase.auth.getSession()
      navigate('/') // Redirect back to main app
    }

    handleAuth()
  }, [navigate])

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Completing sign-in…</p>
    </div>
  )
}
