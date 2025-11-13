import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lightweight stateless auth client only for OTP
export const supabaseLogin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,     // ❗ important
    autoRefreshToken: false,   // stateless
    detectSessionInUrl: false,
    storage: undefined,        // no storage → no side effects
  },
})
