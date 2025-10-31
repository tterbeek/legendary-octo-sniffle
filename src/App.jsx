import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login.jsx'
import ShoppingList from './ShoppingList.jsx'
import AuthCallback from './AuthCallback.jsx'
import Sidebar from './Sidebar.jsx'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [lists, setLists] = useState([])
  const [currentList, setCurrentList] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

useEffect(() => {
  const init = async () => {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)

    if (!session?.user) return
    const userId = session.user.id

    try {
      // Fetch owned lists
      const { data: ownedLists = [], error: ownedError } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)
      if (ownedError) console.error('Error fetching owned lists:', ownedError)

      // Fetch shared lists via list_members
      const { data: sharedMemberships = [], error: sharedError } = await supabase
        .from('list_members')
        .select('lists(*)')
        .eq('user_id', userId)
      if (sharedError) console.error('Error fetching shared lists:', sharedError)

      const sharedLists = sharedMemberships.map(m => m.lists)
      const combinedLists = [...ownedLists, ...sharedLists]

      // Deduplicate lists
      const dedupedLists = combinedLists.filter(
        (list, index, self) => index === self.findIndex(l => l.id === list.id)
      )

      setLists(dedupedLists)

      // Restore last used list from localStorage
      const lastUsedId = localStorage.getItem('lastUsedListId')
      const defaultList = dedupedLists.find(l => l.id === lastUsedId) || dedupedLists[0]
      if (defaultList) setCurrentList(defaultList)

      console.log('Owned lists:', ownedLists)
      console.log('Shared lists:', sharedLists)
      console.log('All lists:', dedupedLists)
    } catch (error) {
      console.error('Error initializing lists:', error)
    }
  }

  init()

  const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
    setSession(sess)
  })
  return () => listener.subscription.unsubscribe()
}, [])


  if (session === undefined)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>

  if (!session)
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )

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
        className="fixed top-4 left-4 z-50 p-2 rounded bg-white shadow-md"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            currentList ? (
              <ShoppingList
                supabase={supabase}
                user={session.user}
                currentList={currentList}
              />
            ) : (
              <div className="flex items-center justify-center min-h-screen">
                No list selected
              </div>
            )
          }
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}
