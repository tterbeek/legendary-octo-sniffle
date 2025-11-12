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
  const [showLogo, setShowLogo] = useState(false);
  const [listsLoading, setListsLoading] = useState(true)


useEffect(() => {
  const lastShown = parseInt(localStorage.getItem('grocLiSplashTime'), 10);
  const FOUR_HOURS = 4 * 60 * 60 * 1000; // 4 hours in ms

  // ✅ Only show if never shown or it’s been more than 4 hours
  if (!lastShown || Date.now() - lastShown > FOUR_HOURS) {
    setShowLogo(true);
    localStorage.setItem('grocLiSplashTime', Date.now().toString());
  }
}, []);

// --- SUPABASE SESSION HANDLING ---
useEffect(() => {
  const setupAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })

    return () => listener.subscription.unsubscribe()
  }

  setupAuth()
}, [])

// --- LIST LOADING WHEN SESSION IS READY ---
// --- LIST LOADING WHEN SESSION IS READY ---
useEffect(() => {
  if (!session?.user) return
  const userId = session.user.id

  const fetchLists = async () => {
    setListsLoading(true) // ✅ Start loading lists

    // 1️⃣ Fetch owned lists
    const { data: ownedLists = [], error: ownedError } = await supabase
      .from('lists')
      .select('*')
      .eq('owner_id', userId)
    if (ownedError) console.error('Error fetching owned lists:', ownedError)

    // 2️⃣ Fetch lists where user is a member (shared lists)
    const { data: sharedMemberships = [], error: sharedError } = await supabase
      .from('list_members')
      .select('lists(*)')
      .eq('user_id', userId)
    if (sharedError) console.error('Error fetching shared lists:', sharedError)

    const sharedLists = sharedMemberships.map(m => m.lists)

    // 3️⃣ Combine owned + shared lists
    const combinedLists = [...ownedLists, ...sharedLists]

    // 4️⃣ Remove duplicate lists by id
    const dedupedLists = combinedLists.filter(
      (list, index, self) => list && index === self.findIndex(l => l.id === list.id)
    )

    // 5️⃣ Sort lists by updated_at (fallback to created_at if missing)
    const sortedLists = dedupedLists.sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
      return bTime - aTime
    })

    // 6️⃣ If user has no lists yet → open sidebar
    if (sortedLists.length === 0) {
      console.log('No lists found – opening sidebar for new user')
      setLists([])
      setCurrentList(null)
      setSidebarOpen(true)
      setListsLoading(false)
      return
    }

    // 7️⃣ Store sorted lists
    setLists(sortedLists)

    // 8️⃣ Try to load last opened list from user_consents (and fallback to localStorage)
    let preferredList = null
    try {
      const { data: consent } = await supabase
        .from('user_consents')
        .select('last_opened_list_id')
        .eq('user_id', userId)
        .maybeSingle()

      const lastOpenedId =
        consent?.last_opened_list_id || localStorage.getItem('lastUsedListId')

      if (lastOpenedId) {
        preferredList = sortedLists.find(l => l.id === lastOpenedId) || null
      }
    } catch (e) {
      console.error('Error fetching last_opened_list_id from user_consents:', e)
    }

    // 9️⃣ Choose the list to open: prefer last opened, else most recently updated
    const defaultList = preferredList || sortedLists[0]

    // 🔟 Set current list + remember locally for offline fallback
    if (defaultList) {
      setCurrentList(defaultList)
      localStorage.setItem('lastUsedListId', defaultList.id)
    }

    setListsLoading(false) // ✅ Done loading
  }

  fetchLists()
}, [session])


  // --- ✅ SPLASH SCREEN SHOWS BEFORE ANYTHING ELSE ---
  if (showLogo) {
    return <GrocLiLogoAnimation onFinish={() => setShowLogo(false)} />
  }

  
  // --- LOADING PLACEHOLDER ---
  if (session === undefined)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>

  // --- NO SESSION: AUTH PAGES ---
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

  // --- LOGGED IN VIEW ---
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
        <p className="text-gray-600 mt-4">No lists found — create one to get started!</p>
      </div>
    )
  }
/>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup onSignup={setSession} />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </BrowserRouter>
  )
}
