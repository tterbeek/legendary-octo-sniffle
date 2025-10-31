// src/Login.jsx
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useNavigate, useSearchParams } from 'react-router-dom'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteId = searchParams.get('invite')

  // 1️⃣ Send OTP code to user's email
  const handleSendOtp = async () => {
    console.log('[Auth] Sending OTP for:', email)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)

    if (error) {
      console.error('[Auth] Error sending OTP:', error)
      alert(error.message)
    } else {
      console.log('[Auth] OTP sent successfully')
      setCodeSent(true)
      alert('Check your email for the 6-digit login code!')
    }
  }

  // 2️⃣ Verify the OTP entered by the user
  const handleVerifyOtp = async () => {
    console.log('[Auth] Verifying OTP for:', email)
    setLoading(true)

    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email', // ✅ Correct for 6-digit code flow
    })

    setLoading(false)

    if (error) {
      console.error('[Auth] OTP verification error:', error)
      alert(error.message)
      return
    }

    const session = sessionData.session
    console.log('[Auth] Logged in successfully:', session?.user?.email)
    onLogin?.(session)

    // 3️⃣ Handle invite (if present)
    try {
      if (inviteId) {
        console.log('[Invite] Found invite ID:', inviteId)

        const { data: inviteData, error: inviteError } = await supabase
          .from('list_invites')
          .select('id, list_id, email, role')
          .eq('id', inviteId)
          .single()

        if (inviteError) {
          console.warn('[Invite] Error fetching invite:', inviteError.message)
        } else if (
          inviteData &&
          inviteData.email.toLowerCase() === session.user.email.toLowerCase()
        ) {
          console.log('[Invite] Invite matched. Adding user to list:', inviteData.list_id)

          const { error: memberError } = await supabase
            .from('list_members')
            .insert([
              {
                list_id: inviteData.list_id,
                user_id: session.user.id,
                role: inviteData.role || 'editor',
              },
            ])

          if (memberError) console.error('[Invite] Error adding to list:', memberError)
          else console.log('[Invite] User successfully added to list_members')

          // Delete the invite so it can't be reused
          await supabase.from('list_invites').delete().eq('id', inviteData.id)
        } else {
          console.warn('[Invite] No matching invite email or invite not found')
        }
      } else {
        console.log('[Invite] No invite ID found in URL')
      }
    } catch (err) {
      console.error('[Invite] Unexpected error:', err)
    }

    // Redirect after login
    navigate('/')
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
            className="border p-2 rounded mb-2 w-64"
          />
          <button
            onClick={handleSendOtp}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50 w-64"
          >
            {loading ? 'Sending...' : 'Send Login Code'}
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-gray-700 text-sm">
            Enter the 6-digit code sent to your email:
          </p>
          <input
            type="text"
            placeholder="Enter code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="border p-2 rounded mb-2 w-64"
          />
          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50 w-64"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </>
      )}
    </div>
  )
}
