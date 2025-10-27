import { useEffect, useState } from 'react'
import Login from './Login.jsx'
import ShoppingList from './ShoppingList.jsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, sess) => setSession(sess))
  }, [])

  if (!session) return <Login />  // show login page if not signed in

  return <ShoppingList supabase={supabase} user={session.user} />
}
