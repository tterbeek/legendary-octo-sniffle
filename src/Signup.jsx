// src/Signup.jsx
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Signup({ onSignup }) {
  const location = useLocation()
  const prefilledEmail = location.state?.email || ''
  const [email, setEmail] = useState(prefilledEmail)
  const [otp, setOtp] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentTerms, setConsentTerms] = useState(false)
  const navigate = useNavigate()

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const inviteId = new URLSearchParams(location.search).get('invite')
  const inviteEmail = new URLSearchParams(location.search).get('email')


  // 1️⃣ Request OTP (token) for signup
  const handleSendOtp = async () => {
      if (!isValidEmail(email)) {
    alert('Please enter a valid email address.')
    return
    }
    if (!consentPrivacy || !consentTerms) {
      alert('You must accept Privacy Policy and Terms of Use.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)

    if (error) {
      console.error('[Signup] Error sending OTP:', error)
      alert(error.message)
    } else {
      console.log('[Signup] OTP sent successfully')
      setCodeSent(true)
    }
  }

  // 2️⃣ Verify OTP and log in the user
  const handleVerifyOtp = async () => {
    setLoading(true)
    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email', // token-based signup
    })
    setLoading(false)

    if (error) {
      console.error('[Signup] OTP verification error:', error)
      alert(error.message)
      return
    }

    const session = sessionData.session
    console.log('[Signup] Logged in successfully:', session?.user?.email)
    onSignup?.(session)

    // ✅ Store consent record
      try {
        const userId = session.user.id
        const { error: consentError } = await supabase.from('user_consents').insert([
          {
            user_id: userId,
            accepted_privacy_policy: true,
            accepted_terms: true,
            privacy_policy_version: 'v1.0',
            terms_version: 'v1.0',
          },
        ])

        if (consentError) {
          console.error('[Signup] Error saving consent:', consentError.message)
        } else {
          console.log('[Signup] Consent recorded for user:', userId)
        }
      } catch (err) {
        console.error('[Signup] Unexpected error saving consent:', err)
      }


// ✅ Handle invite if present in URL
    if (inviteId) {
      console.log('[Invite] Found invite ID:', inviteId)

      try {
        // Fetch invite data from the database
        const { data: inviteData, error: inviteError } = await supabase
          .from('list_invites')
          .select('id, list_id, email, role')
          .eq('id', inviteId)
          .single()

        if (inviteError) {
          console.warn('[Invite] Error fetching invite:', inviteError.message)
        } else if (inviteData && inviteData.email.toLowerCase() === session.user.email.toLowerCase()) {
          console.log('[Invite] Invite matched. Adding user to list:', inviteData.list_id)

          // Add the user to the list_members table
          const { error: memberError } = await supabase
            .from('list_members')
            .insert([
              {
                list_id: inviteData.list_id,
                user_id: session.user.id,
                role: inviteData.role || 'editor',
              },
            ])

          if (memberError) {
            console.error('[Invite] Error adding to list:', memberError)
          } else {
            console.log('[Invite] User successfully added to list_members')
          }

          // Delete the invite so it can't be reused
          await supabase.from('list_invites').delete().eq('id', inviteData.id)
        } else {
          console.warn('[Invite] No matching invite email or invite not found')
        }
      } catch (err) {
        console.error('[Invite] Unexpected error:', err)
      }
    }


    // Redirect to main app (or fetch lists)
    navigate('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-2xl mb-4">Sign Up for GrocLi</h1>

      {!codeSent ? (
        <div className="flex flex-col items-center space-y-2">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded w-64"
          />

          <div className="flex items-center">
            <input
              type="checkbox"
              id="privacy"
              checked={consentPrivacy}
              onChange={(e) => setConsentPrivacy(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="privacy" className="text-sm">
              I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-customGreen underline">Privacy Policy</a>
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="terms"
              checked={consentTerms}
              onChange={(e) => setConsentTerms(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="terms" className="text-sm">
              I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-customGreen underline">Terms of Use</a>
            </label>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={loading}
            className="bg-customGreen text-white px-4 py-2 rounded disabled:opacity-50 w-64"
          >
            {loading ? 'Sending...' : 'Request Signup Code'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-2">
          <p className="text-gray-700 text-sm mb-1">
            Enter the 6-digit code sent to your email:
          </p>
          <input
            type="text"
            placeholder="Enter code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="border p-2 rounded w-64"
          />
          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            className="bg-customGreen text-white px-4 py-2 rounded disabled:opacity-50 w-64"
          >
            {loading ? 'Verifying...' : 'Verify Code & Sign Up'}
          </button>
        </div>
      )}

      <p className="mt-4 text-sm">
        Already have an account? <a href="/login" className="text-customGreen underline">Log in</a>
      </p>
    </div>
  )
}
