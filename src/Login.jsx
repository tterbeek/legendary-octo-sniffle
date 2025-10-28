import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')

  const handleLogin = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return alert('Enter your email')

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) alert(error.message)
    else alert('Check your email for the magic link! Open it in Safari and return to the PWA.')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-2xl mb-4">Login to Shared Shopping List</h1>
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="border p-2 rounded mb-2"
      />
      <button
        onClick={handleLogin}
        className="bg-customGreen text-white px-4 py-2 rounded"
      >
        Send Magic Link
      </button>
    </div>
  )
}
