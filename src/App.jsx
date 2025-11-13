import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login.jsx'
import ShoppingList from './ShoppingList.jsx'
import AuthCallback from './AuthCallback.jsx'
import Sidebar from './Sidebar.jsx'
import { supabase } from './supabaseClient'
import Signup from './Signup.jsx'
import Privacy from './Privacy.jsx'
import Terms from './Terms.jsx'
import GrocLiLogoAnimation from './GrocLiLogoAnimation'
import GrocLiLogoStatic from './GrocLiLogoStatic'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [lists, setLists] = useState([])
  const [currentList, setCurrentList] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [listsLoading, setListsLoading] = useState(true)

  // Splashscreen
  const [showLogo, setShowLogo] = useState(false)
  useEffect(() => {
    const lastShown = parseInt(localStorage.getItem('grocLiSplashTime'), 10)
    const FOUR_HOURS = 4 * 60 * 60 * 1000

    if (!lastShown || Date.now() - lastShown > FOUR_HOURS) {
      setShowLogo(true)
      localStorage.setItem('grocLiSplashTime', Date.now().toString())
    }
  }, [])

  // Load initial session
  useEffect(() => {
    let mounted = true

    const init = async () => {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession()
// 🔥 Force refresh if token exists but session is null
if (!initialSession) {
  await supabase.auth.refreshSession()
}

      if (mounted) setSession(initialSession ?? null)
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, data) => {
        if (!mounted) return

        console.log('AUTH EVENT:', event)

        if (
          event === 'INITIAL_SESSION' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED'
        ) {
          setSession(data.session ?? null)
        }

        if (event === 'SIGNED_OUT') {
          setSession(null)
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Fetch lists
  useEffect(() => {
    if (!session?.user) return
    const userId = session.user.id

    const fetchLists = async () => {
      setListsLoading(true)

      // Owned lists
      const { data: ownedLists = [] } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)

      // Shared lists
      const { data: sharedMemberships = [] } = await supabase
        .from('list_members')
        .select('lists(*)')
        .eq('user_id', userId)

      const sharedLists = sharedMemberships.map(m => m.lists)

      // Combine & dedupe
      const deduped = [...ownedLists, ...sharedLists].filter(
        (l, i, arr) => l && i === arr.findIndex(a => a.id === l.id)
      )

      if (deduped.length === 0) {
        setLists([])
        setCurrentList(null)
        setSidebarOpen(true)
        setListsLoading(false)
        return
      }

      // Sort newest first
      const sorted = deduped.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at)
      )

      setLists(sorted)

      // Restore last viewed list
      let localLast = null
      try {
        localLast = localStorage.getItem('lastUsedListId')
      } catch {}

      let remoteLast = null
      try {
        const { data } = await supabase
          .from('user_consents')
          .select('last_opened_list_id')
          .eq('user_id', userId)
          .maybeSingle()

        remoteLast = data?.last_opened_list_id || null
      } catch {}

      const chosen =
        sorted.find(l => l.id === remoteLast) ||
        sorted.find(l => l.id === localLast) ||
        sorted[0]

      setCurrentList(chosen)
      if (chosen) {
        localStorage.setItem('lastUsedListId', chosen.id)
      }

      setListsLoading(false)
    }

    fetchLists()
  }, [session])

  // Splashscreen
  if (showLogo) {
    return <GrocLiLogoAnimation onFinish={() => setShowLogo(false)} />
  }

  // Still determining session
  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  // Not logged in
  if (!session) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<Login onLogin={setSession} />} />
          <Route path="/signup" element={<Signup onSignup={setSession} />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // Logged in UI
  return (
    <BrowserRouter>
      {sidebarOpen && (
        <Sidebar
          lists={lists}
          setLists={setLists}
          currentList={currentList}
          setCurrentList={setCurrentList}
          session={session}
          closeSidebar={() => setSidebarOpen(false)}
        />
      )}

      <button
        className={`fixed top-4 left-4 z-50 p-3 rounded text-xl transition-colors ${
          sidebarOpen ? 'bg-white' : 'bg-gray-50'
        }`}
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/"
          element={
            listsLoading ? (
              <div className="flex flex-col items-center justify-center min-h-screen">
                <GrocLiLogoStatic />
                <p className="text-gray-500 mt-4">Loading your lists...</p>
              </div>
            ) : currentList ? (
              <ShoppingList
                supabase={supabase}
                user={session.user}
                currentList={currentList}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-screen text-center">
                <GrocLiLogoStatic />
                <p className="text-gray-600 mt-4">
                  No lists found — create one to get started!
                </p>
              </div>
            )
          }
        />

        <Route path="/login" element={<Login onLogin={setSession} />} />
        <Route path="/signup" element={<Signup onSignup={setSession} />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </BrowserRouter>
  )
}
