// src/Sidebar.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import SupportModal from './SupportModal';


export default function Sidebar({ lists, setLists, currentList, setCurrentList, session, closeSidebar }) {
  const [newListName, setNewListName] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMenu, setActiveMenu] = useState(null)
  
  const sidebarRef = useRef()
  const menuRefs = useRef({}) // stores refs for each list's context menu

  const [showSupportModal, setShowSupportModal] = useState(false);

  // -----------------------------
  // Realtime subscription for lists
  // -----------------------------
 useEffect(() => {
  if (!session?.user?.id) return

  // Function to create a channel
  const createRealtimeChannel = () => {
    const channel = supabase
      .channel(`user-lists-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
          filter: `owner_id=eq.${session.user.id}`,
        },
        payload => {
          const newList = payload.new
          const oldList = payload.old

          if (payload.eventType === 'INSERT') {
            setLists(prev => prev.some(l => l.id === newList.id) ? prev : [...prev, newList])
          } else if (payload.eventType === 'UPDATE') {
            setLists(prev => prev.map(l => l.id === newList.id ? newList : l))
          } else if (payload.eventType === 'DELETE') {
            setLists(prev => prev.filter(l => l.id !== oldList.id))
            if (currentList?.id === oldList.id) setCurrentList(null)
          }
        }
      )
      .subscribe()

    return channel
  }

  // Function to handle online and offline states
  const handleOnline = () => {
    console.log('Online: Reconnecting Realtime...')
    const channel = createRealtimeChannel() // Reconnect the channel when online
    return channel
  }

  const handleOffline = () => {
    console.log('Offline: Disconnecting Realtime...')
    supabase.removeChannel(channel) // Remove the WebSocket channel when offline
  }

  // Initialize channel when online, or disconnect when offline
  let channel
  if (navigator.onLine) {
    channel = createRealtimeChannel() // Create channel if online
  } else {
    handleOffline() // Handle initial offline state
  }

  // Listen for online/offline events
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (channel) {
      supabase.removeChannel(channel) // Cleanup channel on unmount
    }
  }
}, [session?.user?.id, currentList?.id])

  // -----------------------------
  // Close sidebar if clicking outside
  // -----------------------------
  useEffect(() => {
    const handleClickOutsideSidebar = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        closeSidebar()
      }
    }
    document.addEventListener('mousedown', handleClickOutsideSidebar)
    return () => document.removeEventListener('mousedown', handleClickOutsideSidebar)
  }, [closeSidebar])

  // -----------------------------
  // Close context menu if clicking outside
  // -----------------------------
  useEffect(() => {
    const handleClickOutsideMenu = (e) => {
      if (activeMenu !== null) {
        const menuEl = menuRefs.current[activeMenu]
        if (menuEl && !menuEl.contains(e.target)) {
          setActiveMenu(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutsideMenu)
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu)
  }, [activeMenu])

  // -----------------------------
  // Handlers: create, share, delete, rename
  // -----------------------------
  const handleCreateList = async () => {
    const name = newListName.trim()
    if (!name) return alert('Enter a list name')

    const { data: listData, error: listError } = await supabase
      .from('lists')
      .insert([{ name, owner_id: session.user.id }])
      .select()
      .single()
    if (listError) return alert(listError.message)

    const { error: memberError } = await supabase
      .from('list_members')
      .insert([{ list_id: listData.id, user_id: session.user.id, role: 'editor' }])
    if (memberError) return alert(memberError.message)

    setLists(prev => [...prev, listData])
    setCurrentList(listData)
    setNewListName('')
    closeSidebar()
  }

  const handleShareList = async (list) => {
    const email = prompt('Enter email to share this list:')?.trim()
    if (!email) return alert('Please enter an email.')

    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, listName: list.name, listId: list.id, inviterEmail: user.email
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) return alert(`Failed: ${result.error}`)
      alert(result.invited === 'existing'
        ? `User ${email} was added and notified.`
        : `Invite email sent to ${email}.`)
    } catch (err) {
      console.error(err)
      alert('Failed to share list.')
    } finally {
      setLoading(false)
      setActiveMenu(null)
    }
  }

  const handleDeleteList = async (list) => {
    if (!window.confirm(`Delete list "${list.name}"? This cannot be undone.`)) return
    try {
      await supabase.from('items_new').delete().eq('list_id', list.id)
      await supabase.from('list_members').delete().eq('list_id', list.id)
      await supabase.from('lists').delete().eq('id', list.id)
      setLists(prev => prev.filter(l => l.id !== list.id))
      if (currentList?.id === list.id) setCurrentList(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete list.')
    } finally {
      setActiveMenu(null)
    }
  }

  const handleRenameList = async (list) => {
    const newName = prompt('Enter new name:', list.name)?.trim()
    if (!newName) return
    try {
      const { data, error } = await supabase.from('lists').update({ name: newName }).eq('id', list.id).select().single()
      if (error) return alert(error.message)
      setLists(prev => prev.map(l => l.id === list.id ? data : l))
    } catch (err) {
      console.error(err)
      alert('Failed to rename list.')
    } finally {
      setActiveMenu(null)
    }
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div ref={sidebarRef} className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg p-4 z-40 flex flex-col">
      <button
        className="self-end mb-4 p-1 text-gray-500 hover:text-gray-700"
        onClick={closeSidebar}
      >✕</button>

      <h2 className="text-lg font-semibold mb-4">Your Lists</h2>

      <div className="flex-1 overflow-y-auto">
        {lists.map(list => (
          <div
            key={list.id}
            className={`flex items-center justify-between w-full mb-1 rounded px-2 ${
              currentList?.id === list.id ? 'bg-customGreen text-white' : ''
            }`}
          >
            <button
              className="text-left flex-1 py-1 rounded-l"
              onClick={async () => {
                setCurrentList(list)
                localStorage.setItem('lastUsedListId', list.id)
                closeSidebar()

                try {
                  // ✅ Upsert user consent safely
                  const { error } = await supabase
                    .from('user_consents')
                    .upsert(
                      {
                        user_id: session.user.id,
                        last_opened_list_id: list.id,
                        // Explicitly set defaults for new users, but won't overwrite existing values
                        accepted_privacy_policy: false,
                        accepted_terms: false,
                      },
                      {
                        onConflict: 'user_id',
                        ignoreDuplicates: false, // overwrite last_opened_list_id if row exists
                      }
                    )
                  if (error) console.error('Failed to upsert user_consents:', error)
                } catch (err) {
                  console.error('Failed to update or create user_consents row:', err)
                }
              }}


            >
              {list.name}
            </button>

            {list.owner_id === session.user.id && (
              <div className="relative">
                <button
                  className={`px-1 py-0.5 ${currentList?.id === list.id ? 'text-white' : 'text-gray-500'} hover:text-gray-200`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenu(activeMenu === list.id ? null : list.id)
                  }}
                >
                  ⋮
                </button>

                {activeMenu === list.id && (
                  <div
                    ref={el => menuRefs.current[list.id] = el}
                    className="absolute right-0 top-full mt-1 w-32 bg-white text-gray-700 rounded shadow-lg z-50"
                  >
                    <button
                      className="block w-full text-left px-2 py-1 hover:bg-gray-100"
                      onClick={() => handleRenameList(list)}
                    >Rename</button>
                    <button
                      className="block w-full text-left px-2 py-1 hover:bg-gray-100"
                      onClick={() => handleShareList(list)}
                    >Share</button>
                    <button
                      className="block w-full text-left px-2 py-1 text-red-500 hover:bg-gray-100"
                      onClick={() => handleDeleteList(list)}
                    >Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
        {/* Create new list */}
        <div className="mt-4">
          <button
            className="w-full flex items-center justify-center gap-2 bg-customGreen text-white px-2 py-2 rounded hover:bg-customGreen-hover transition-colors"
            onClick={async () => {
              const name = prompt('Enter new list name:')?.trim()
              if (!name) return
              const { data: listData, error: listError } = await supabase
                .from('lists')
                .insert([{ name, owner_id: session.user.id }])
                .select()
                .single()
              if (listError) return alert(listError.message)

              const { error: memberError } = await supabase
                .from('list_members')
                .insert([{ list_id: listData.id, user_id: session.user.id, role: 'editor' }])
              if (memberError) return alert(memberError.message)

              setLists(prev => [...prev, listData])
              setCurrentList(listData)
              closeSidebar()
            }}
          >
            <span className="text-xl font-bold">+</span> Create List
          </button>
        </div>

      {/* Support the Developer */}
      <div className="mt-2">
        <button
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white px-2 py-2 rounded hover:bg-yellow-600 transition-colors"
          onClick={() => setShowSupportModal(true)}
        >
          ☕ Support the Developer
        </button>
      </div>

      {showSupportModal && (
        <SupportModal onClose={() => setShowSupportModal(false)} />
      )}

    </div>
  )
}
