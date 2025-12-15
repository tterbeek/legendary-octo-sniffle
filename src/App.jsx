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
import SupportModal from './SupportModal'
import ShareDialog from './ShareDialog'
export default function App() {
  const [session, setSession] = useState(undefined)
  const [lists, setLists] = useState([])
  const [currentList, setCurrentList] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [listsLoading, setListsLoading] = useState(true)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState(null)
  const [shareName, setShareName] = useState('')
  const [sharing, setSharing] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

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


      if (mounted) setSession(initialSession ?? null)
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange(
  (event, data) => {
    if (!mounted) return

    console.log("AUTH EVENT:", event)

    // Only update session when Supabase provides a real session
    if (data.session) {
      setSession(data.session)
    }

    // Explicit logout handler
    if (event === "SIGNED_OUT") {
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
      const { data: ownedLists = [], error: ownedError } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)

      if (ownedError) {
        console.error('Failed to load owned lists', ownedError)
      }

      // Shared lists
      const { data: sharedMemberships = [], error: sharedError } = await supabase
        .from('list_members')
        .select('lists(*)')
        .eq('user_id', userId)

      if (sharedError) {
        console.error('Failed to load shared lists', sharedError)
      }

      const sharedLists = (sharedMemberships || [])
        .map(m => m?.lists)
        .filter(Boolean)

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

  // Prefill display name for sharing
  useEffect(() => {
    if (!session?.user?.id) return
    const loadDisplayName = async () => {
      try {
        const { data } = await supabase
          .from('user_consents')
          .select('display_name')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (data?.display_name) setShareName(data.display_name)
      } catch (err) {
        console.error('Failed to load display_name', err)
      }
    }
    loadDisplayName()
  }, [session?.user?.id])

  // Global support modal listener (for tooltips triggering it)
  useEffect(() => {
    const openSupport = () => {
      setSupportOpen(true)
      try {
        localStorage.setItem('groc_support_opened', '1')
        localStorage.removeItem('groc_support_pending')
      } catch {}
    }
    window.addEventListener('open-support-modal', openSupport)

    // If a pending flag exists, open once
    try {
      const pending = localStorage.getItem('groc_support_pending')
      const opened = localStorage.getItem('groc_support_opened')
      if (pending && !opened) {
        openSupport()
      }
    } catch {}

    return () => window.removeEventListener('open-support-modal', openSupport)
  }, [])

  const openSupportManually = () => {
    setSupportOpen(true)
    try {
      localStorage.setItem('groc_support_opened', '1')
      localStorage.removeItem('groc_support_pending')
    } catch {}
  }

  const closeSupport = () => setSupportOpen(false)

  const openShareDialog = (list) => {
    if (!list) return
    setShareTarget(list)
    setShareDialogOpen(true)
  }

  const closeShareDialog = () => {
    setShareDialogOpen(false)
    setShareTarget(null)
  }

  const handleShare = async ({ email, name }) => {
    if (!shareTarget) throw new Error('No list selected.')
    const trimmedEmail = (email || '').trim()
    const trimmedName = (name || '').trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!trimmedEmail) throw new Error('Please enter an email.')
    if (!emailRegex.test(trimmedEmail)) throw new Error('Enter a valid email.')

    setSharing(true)
    try {
      const { data } = await supabase.auth.getUser()
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          listName: shareTarget.name,
          listId: shareTarget.id,
          inviterEmail: data?.user?.email || session?.user?.email,
          displayName: trimmedName || null,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to share list.')

      setShareName(trimmedName)

      try {
        await supabase
          .from('user_consents')
          .upsert(
            { user_id: session.user.id, display_name: trimmedName || null },
            { onConflict: 'user_id' }
          )
      } catch (err) {
        console.error('Failed to save display_name', err)
      }

      return true
    } catch (err) {
      console.error(err)
      throw err
    } finally {
      setSharing(false)
    }
  }

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
    <>
      <BrowserRouter>
      {sidebarOpen && (
        <Sidebar
          lists={lists}
          setLists={setLists}
          currentList={currentList}
          setCurrentList={setCurrentList}
          session={session}
          closeSidebar={() => setSidebarOpen(false)}
          onShareList={openShareDialog}
          onOpenSupport={openSupportManually}
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
                onShareList={openShareDialog}
                shareLoading={sharing}
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

      <ShareDialog
        open={shareDialogOpen}
        defaultName={shareName}
        loading={sharing}
        onClose={closeShareDialog}
        onShare={handleShare}
      />

      {supportOpen && <SupportModal onClose={closeSupport} />}
    </>
  )
}
