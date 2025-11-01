// src/Sidebar.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Sidebar({ lists, setLists, currentList, setCurrentList, session, closeSidebar }) {
  const [newListName, setNewListName] = useState('')
  const [showDeleteTip, setShowDeleteTip] = useState(null) // stores list.id for tooltip
  const [loading, setLoading] = useState(false);
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL

  // Create a new list
  const handleCreateList = async () => {
    const name = newListName.trim()
    if (!name) return alert('Enter a list name')

    // Insert list into Supabase
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .insert([{ name, owner_id: session.user.id }])
      .select()
      .single()

    if (listError) return alert(listError.message)

    // Add the current user as a member (editor role)
    const { error: memberError } = await supabase
      .from('list_members')
      .insert([{ list_id: listData.id, user_id: session.user.id, role: 'editor' }])

    if (memberError) return alert(memberError.message)

    // Update local state
    setLists([...lists, listData])
    setCurrentList(listData)
    setNewListName('')
    closeSidebar()
  }

const handleShareList = async () => {
  const email = prompt('Enter the email of the user to share this list with:')?.trim();
  if (!email) return alert('Please enter an email to share with.');

  setLoading(true);

  try {
    const user = (await supabase.auth.getUser()).data.user;

    const response = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        listName: currentList.name,
        listId: currentList.id,
        inviterEmail: user.email,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('Invite failed:', result.error);
      return alert(`Failed to send invite: ${result.error}`);
    }

    if (result.invited === 'existing') {
      alert(`User ${email} was added to the list and has been notified.`);
    } else {
      alert(`Invite email sent to ${email}. They can join via the signup link.`);
    }
  } catch (err) {
    console.error('Error sharing list:', err);
    alert('Failed to share list. See console for details.');
  } finally {
    setLoading(false);
  }
};



return (
  <div className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg p-4 z-40 flex flex-col">
    {/* Close button */}
    <button
      className="self-end mb-4 p-1 text-gray-500 hover:text-gray-700"
      onClick={closeSidebar}
    >
      ✕
    </button>

    <h2 className="text-lg font-semibold mb-4">Your Lists</h2>

    {/* List of lists */}
    <div className="flex-1 overflow-y-auto">
{lists.map(list => (
  <div key={list.id} className="flex items-center justify-between w-full mb-1">
    <button
      className={`text-left px-2 py-1 rounded w-full ${
        currentList?.id === list.id ? 'bg-customGreen text-white font-semibold' : 'text-gray-700'
      }`}
      onClick={() => {
        setCurrentList(list)
        localStorage.setItem('lastUsedListId', list.id) // store last used list
        closeSidebar()
        }}

    >
      {list.name}
    </button>
    {list.owner_id === session.user.id && (
      <button
        className="ml-2 text-red-500 hover:text-red-700 px-1 py-0.5"
        onClick={async (e) => {
          e.stopPropagation() // prevent switching list
          const confirmed = window.confirm(`Delete list "${list.name}"? This cannot be undone.`)
          if (!confirmed) return
          try {
            await supabase.from('items').delete().eq('list_id', list.id)
            await supabase.from('past_items').delete().eq('list_id', list.id)
            await supabase.from('list_members').delete().eq('list_id', list.id)
            await supabase.from('lists').delete().eq('id', list.id)
            setLists(prev => prev.filter(l => l.id !== list.id))
            if (currentList?.id === list.id) setCurrentList(null)
          } catch (err) {
            console.error('Delete error', err)
            alert('Failed to delete list.')
          }
        }}
      >
        🗑️
      </button>
    )}
  </div>
))}

    </div>

    {/* Create new list */}
    <div className="mt-4">
      <input
        type="text"
        placeholder="New list name"
        value={newListName}
        onChange={e => setNewListName(e.target.value)}
        className="border p-1 rounded w-full mb-2"
      />
      <button
        className="w-full bg-customGreen text-white px-2 py-1 rounded"
        onClick={handleCreateList}
      >
        Create List
      </button>
    </div>

    {/* Share current list */}
    {currentList && (
      <button
        className="mt-4 w-full customGreen text-white px-2 py-1 rounded"
        onClick={handleShareList}
      >
        Share List
      </button>
    )}
  </div>
)


}