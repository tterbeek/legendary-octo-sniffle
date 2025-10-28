import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true })
      if (error) {
        setErrorMsg(error.message)
      } else if (data?.session) {
        // Session is stored; user can now return to PWA
        setErrorMsg('Success! You can now return to the PWA app.')
      }
      setLoading(false)
    }

    handleAuth()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
      {loading ? (
        <p>Processing login...</p>
      ) : errorMsg.includes('Success') ? (
        <>
          <p className="text-green-600 font-semibold mb-2">{errorMsg}</p>
          <p>Switch back to the PWA to continue using the app.</p>
        </>
      ) : (
        <p className="text-red-600 font-semibold">{errorMsg}</p>
      )}
    </div>
  )
}
