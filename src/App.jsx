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
      const fetchLists = async (attempt = 1) => {
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

        // ⏳ Retry up to 5 times if no lists yet (for brand new users)
        if (dedupedLists.length === 0 && attempt < 5) {
          console.log(`No lists yet, retrying in 1s (attempt ${attempt})...`)
          setTimeout(() => fetchLists(attempt + 1), 1000)
          return
        }

        setLists(dedupedLists)

        // Restore last used list from localStorage
        const lastUsedId = localStorage.getItem('lastUsedListId')
        const defaultList =
          dedupedLists.find(l => l.id === lastUsedId) ||
          dedupedLists.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

        if (defaultList) {
          setCurrentList(defaultList)
        } else {
          console.log('No list found, opening sidebar for new user')
          setSidebarOpen(true)
        }
      }

      await fetchLists()
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
              <div className="flex flex-col items-center justify-center min-h-screen">
                <p className="mb-4 text-gray-600">No list selected</p>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="px-4 py-2 bg-customGreen text-white rounded shadow hover:bg-blue-700"
                >
                  Create or Select a List
                </button>
              </div>
            )
          }
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}
