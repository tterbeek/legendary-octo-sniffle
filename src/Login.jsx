// src/Login.jsx
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom' // comment out if not using React Router

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  
  const navigate = useNavigate() // React Router

  // Step 1: Send magic link + token email
  const handleSendEmail = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      setCodeSent(true)
      alert('Check your email for the magic link and 6-digit code!')
    }
  }

  // Step 2: Verify token manually
  const handleVerifyOtp = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'magiclink', // also works for signup/recovery
    })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert('Signed in successfully!')
      onLogin?.(data.session)

      // --- Redirect after login ---
      if (navigate) {
        navigate('/') // React Router path
      } else {
        window.location.reload() // fallback
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-2xl mb-4">Login to Shared Shopping List</h1>

      {!codeSent ? (
        <>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded mb-2"
          />
          <button
            onClick={handleSendEmail}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-gray-700 text-sm">
            If you’re on iOS and the magic link doesn’t work, enter the 6-digit code from your email:
          </p>
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="border p-2 rounded mb-2"
          />
          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </>
      )}
    </div>
  )
}
