import { useEffect, useState, useRef } from 'react'
import FitText from './FitText'
import useOfflineQueue from './UseOfflineQueue.js'
import CartHeader from './CartHeader';

export default function ShoppingList({ supabase, user, currentList }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeItem, setActiveItem] = useState(null)
  const touchTimerRef = useRef(null)
  const touchThreshold = 800 // ms for long press
  const suggestionTouchTimerRef = useRef(null)
  const suggestionTouchThreshold = 800
  const { isOnline, queueAction } = useOfflineQueue(supabase)



  // -----------------------------
  // Fetch items and suggestions
  // -----------------------------
  const fetchItems = async () => {
    if (!currentList) return
    const { data, error } = await supabase
      .from('items_new')
      .select('*')
      .eq('list_id', currentList.id)
      .eq('checked', false)
      .order('updated_at', { ascending: true })
    if (error) console.error('Error fetching items:', error)
    else setItems(data || [])
  }

  const fetchSuggestions = async () => {
    if (!currentList) return
    const { data, error } = await supabase
      .from('items_new')
      .select('name, updated_at')
      .eq('list_id', currentList.id)
      .eq('checked', true)
      .order('updated_at', { ascending: false })
    if (error) console.error('Error fetching suggestions:', error)
    else setSuggestions(data?.map(d => d.name) || [])
  }

  // -----------------------------
  // Realtime subscription
  // -----------------------------
useEffect(() => {
  if (!currentList) return

  // Realtime channel creation
  const createRealtimeChannel = () => {
    const channel = supabase
      .channel(`items-new-changes-${currentList.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items_new',
          filter: `list_id=eq.${currentList.id}`,
        },
        async () => {
          await fetchItems()
          await fetchSuggestions()
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

  // Initial fetch
  fetchItems()
  fetchSuggestions()

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
      supabase.removeChannel(channel) // Cleanup when component is unmounted
    }
  }
}, [currentList])


 const markItemChecked = async (item) => {
  try {
    await queueAction({
      table: 'items_new',
      type: 'update',
      data: { checked: true, quantity: 1, updated_at: new Date().toISOString() },
      match: { id: item.id },
    })

    // ✅ Optimistic UI
    setItems(prev => prev.filter(i => i.id !== item.id))
    setSuggestions(prev => [item.name, ...prev.filter(s => s !== item.name)])
  } catch (err) {
    console.error('Error marking item checked:', err)
    if (err.message !== 'Offline') alert('Could not mark item as checked.')
  }
}

const updateItemQuantity = async (itemId, quantity) => {
  try {
    await queueAction({
      table: 'items_new',
      type: 'update',
      data: { quantity, updated_at: new Date().toISOString() },
      match: { id: itemId },
    })

    // ✅ Optimistic UI
    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, quantity } : i))
    )
  } catch (err) {
    console.error('Error updating quantity:', err)
    if (err.message !== 'Offline') alert('Could not update quantity.')
  }
}


 // -----------------------------
// Touch handlers (items & suggestions)
// -----------------------------

const longPressTriggered = useRef(false)
const suggestionLongPressTriggered = useRef(false)

// --- ITEM TOUCH HANDLERS ---
const handleTouchStart = (item) => {
  longPressTriggered.current = false

  touchTimerRef.current = setTimeout(() => {
    longPressTriggered.current = true
    setActiveItem(item) // open quantity modal
  }, touchThreshold)
}

const handleTouchEnd = async (item) => {
  if (touchTimerRef.current) {
    clearTimeout(touchTimerRef.current)
    touchTimerRef.current = null
  }

  // 👇 If long press fired, DO NOT mark as checked
  if (longPressTriggered.current) return

  // Short tap → mark as checked
  await markItemChecked(item)
}


// --- SUGGESTION TOUCH HANDLERS ---
const handleSuggestionTouchStart = (name) => {
  suggestionLongPressTriggered.current = false

  suggestionTouchTimerRef.current = setTimeout(async () => {
    suggestionLongPressTriggered.current = true

    if (window.confirm(`Delete "${name}" from suggestions permanently?`)) {
      try {
        // delete all checked entries with that name
        await queueAction({
          table: 'items_new',
          type: 'delete',
          match: { name, checked: true },
        })

        // Optimistic UI
        setSuggestions((prev) => prev.filter((s) => s !== name))
      } catch (err) {
        console.error('Error deleting suggestion:', err)
        alert('Could not delete suggestion.')
      }
    }

    suggestionTouchTimerRef.current = null
  }, suggestionTouchThreshold)
}

const handleSuggestionTouchEnd = (name) => {
  if (suggestionTouchTimerRef.current) {
    clearTimeout(suggestionTouchTimerRef.current)
    suggestionTouchTimerRef.current = null
  }

  // If long press already handled → do nothing
  if (suggestionLongPressTriggered.current) return

  // Short tap → add item
  addItem(name)
}

const handleSuggestionTouchCancel = () => {
  if (suggestionTouchTimerRef.current) {
    clearTimeout(suggestionTouchTimerRef.current)
    suggestionTouchTimerRef.current = null
  }
  suggestionLongPressTriggered.current = false
}



  // -----------------------------
  // Right-click handler (desktop)
  // -----------------------------
  const handleRightClick = (e, item) => {
    e.preventDefault()
    setActiveItem(item)
  }

  const handleSuggestionRightClick = async (e, name) => {
    e.preventDefault()
    if (window.confirm(`Delete "${name}" from suggestions?`)) {
      await supabase
        .from('items_new')
        .delete()
        .eq('name', name)
        .eq('checked', true)
      setSuggestions(prev => prev.filter(s => s !== name))
    }
  }



// -----------------------------
// Add item
// -----------------------------
const addItem = async (name) => {
  name = name.trim()
  if (!name) return

  // Prevent duplicate items currently in the list
  if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
    alert(`"${name}" is already in your shopping list.`)
    return
  }

  // ❗ Normalized timestamp once (reduces flicker)
  const now = new Date().toISOString()

  try {
    // ==========================================
    // 1️⃣ OFFLINE MODE — Optimistic Insert Only
    // ==========================================
    if (!isOnline) {
      const newItem = {
        id: crypto.randomUUID(),
        name,
        quantity: 1,
        checked: false,
        list_id: currentList.id,
        updated_at: now,
      }

      // Optimistic UI insert
      setItems(prev => [...prev, newItem])

      // Queue insert for sync
      await queueAction({
        table: 'items_new',
        type: 'insert',
        data: [newItem],
      })

      setInput('')
      return
    }

    // ==========================================
    // 2️⃣ ONLINE — Check if item already exists as suggestion
    // ==========================================
    const { data: existing, error } = await supabase
      .from('items_new')
      .select('*')
      .eq('list_id', currentList.id)
      .ilike('name', name)
      .maybeSingle()

    if (error) throw error

    // ==========================================
    // 3️⃣ Item exists but is checked → turn it back into active item
    // ==========================================
    if (existing) {
      // Queue update
      await queueAction({
        table: 'items_new',
        type: 'update',
        data: { checked: false, updated_at: now },
        match: { id: existing.id },
      })

      // Optimistically remove from suggestions
      setSuggestions(prev =>
        prev.filter(s => s.toLowerCase() !== name.toLowerCase())
      )

      // ❗ IMPORTANT:
      // Do NOT optimistic-insert this item when online.
      // Realtime will deliver it cleanly → no flicker.

      setInput('')
      return
    }

    // ==========================================
    // 4️⃣ NEW ITEM — Insert normally
    // ==========================================
    const tempId = crypto.randomUUID()
    const newItem = {
      id: tempId,
      name,
      quantity: 1,
      checked: false,
      list_id: currentList.id,
      updated_at: now,
    }

    // Optimistic UI
    setItems(prev => [...prev, newItem])

    // Queue insert to Supabase
    await queueAction({
      table: 'items_new',
      type: 'insert',
      data: [newItem],
    })

    setInput('')

  } catch (err) {
    console.error('Error adding item:', err)
    if (err.message !== 'Offline') {
      alert('Could not add item. Please try again.')
    }
  }
}



  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !items.some(i => i.name === s)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
    {/* 🔌 Offline Banner */}
    {!isOnline && (
      <div className="fixed top-0 left-0 right-0 bg-yellow-200 text-center text-sm py-1 z-50 shadow">
        ⚠️ Offline mode — changes will sync when back online
      </div>
    )}


{/* Compact Header with Drive-In Cart pushing title */}
<div className="flex items-center justify-center gap-2 overflow-hidden">
  {/* Cart drives in from the left */}
<CartHeader title={currentList?.name || 'Shopping List'} />

</div>


      <div className="w-full max-w-2xl bg-white shadow rounded-2xl p-4">
        {/* Shopping List Grid */}
        <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map(item => (
            <li
              key={item.id}
              onTouchStart={() => handleTouchStart(item)}
              onTouchEnd={() => handleTouchEnd(item)}
              onTouchCancel={() => handleTouchEnd(item)}
              onContextMenu={(e) => handleRightClick(e, item)}
              onClick={() => markItemChecked(item)}  // quantity resets to 1
              className="relative bg-customGreen text-white font-semibold flex flex-col items-center justify-center h-24 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
            >
              {item.name.split(' ').map((word, i) => (
                <FitText key={i} text={word} maxFont={20} minFont={10} padding={16} />
              ))}
              {item.quantity && item.quantity > 1 && (
                <div className="absolute top-1 right-1 bg-white text-customGreen text-xs font-bold rounded-full px-2 py-0.5">
                  {item.quantity}
                </div>
              )}
            </li>
          ))}
        </ul>

      {/* Quantity Dialog */}
      {activeItem && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded-xl shadow-md w-64 text-center">
            <h2 className="text-lg font-semibold mb-2">{activeItem.name}</h2>

            {/* Quick Quantity Buttons */}
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => {
                    updateItemQuantity(activeItem.id, num)
                    setActiveItem(null)
                  }}
                  className="bg-customGreen text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-customGreen/80"
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Custom Quantity Input */}
            <input
              type="number"
              min="1"
              placeholder="Custom number"
              className="border rounded px-2 py-1 w-full mb-3"
              onKeyDown={async e => {
              if (e.key === 'Enter') {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num > 0) {
                  updateItemQuantity(activeItem.id, num)
                  setActiveItem(null)
                }
              }
              }}
            />

            <button
              onClick={() => setActiveItem(null)}
              className="text-gray-500 underline text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}



        {/* Add Item Input */}
        <div className="flex mt-4 mb-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem(input)}
            placeholder="Add item..."
            className="flex-1 border p-2 rounded-l-lg"
          />
          <button
            onClick={() => addItem(input)}
            className="bg-customGreen text-white px-4 rounded-r-lg"
          >
            Add
          </button>
        </div>

        {/* Suggestions Grid */}
        {filteredSuggestions.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
          {filteredSuggestions.map(name => (
            <li
              key={name}
              onClick={() => addItem(name)} // tap / left click adds to list
                onTouchStart={() => handleSuggestionTouchStart(name)}
                onTouchEnd={() => handleSuggestionTouchEnd(name)}
                onTouchCancel={handleSuggestionTouchCancel}
                onContextMenu={(e) => handleSuggestionRightClick(e, name)}
              className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
            >
              {name.split(' ').map((word, i) => (
                <FitText key={i} text={word} maxFont={18} minFont={10} padding={16} />
              ))}
            </li>
          ))}
        </ul>

        )}
      </div>
    </div>
  )
}
