import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,     // ← store session in localStorage
    autoRefreshToken: true,   // ← rotates session before expiry
    detectSessionInUrl: true, // ← required for magic link/OTP
  },
})
