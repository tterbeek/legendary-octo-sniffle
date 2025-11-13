import { useEffect, useState, useRef } from 'react'
import FitText from './FitText'
import useOfflineQueue from './UseOfflineQueue.js'
import CartHeader from './CartHeader'

export default function ShoppingList({ supabase, user, currentList }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeItem, setActiveItem] = useState(null)

  const { isOnline, queueAction } = useOfflineQueue(supabase)

  // Long-press timers
  const longPressTriggered = useRef(false)
  const suggestionLongPressTriggered = useRef(false)
  const touchTimerRef = useRef(null)
  const suggestionTouchTimerRef = useRef(null)
  const LONG_PRESS = 800

  // =========================================
  // Fetch items + suggestions
  // =========================================
  const fetchItems = async () => {
    if (!currentList) return
    const { data } = await supabase
      .from('items_new')
      .select('*')
      .eq('list_id', currentList.id)
      .eq('checked', false)
      .order('updated_at', { ascending: true })

    setItems(data || [])
  }

  const fetchSuggestions = async () => {
    if (!currentList) return
    const { data } = await supabase
      .from('items_new')
      .select('name, updated_at')
      .eq('list_id', currentList.id)
      .eq('checked', true)
      .order('updated_at', { ascending: false })

    setSuggestions(data?.map(d => d.name) || [])
  }

  // =========================================
  // Realtime (fully fixed)
  // =========================================
  useEffect(() => {
    if (!currentList) return

    let channel = null

    const createChannel = () => {
      channel = supabase
        .channel(`items-${currentList.id}`)
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
    }

    const disconnect = () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    // initial fetch
    fetchItems()
    fetchSuggestions()

    if (navigator.onLine) createChannel()

    const reOnline = () => {
      disconnect()
      createChannel()
    }

    window.addEventListener('online', reOnline)
    window.addEventListener('offline', disconnect)

    return () => {
      window.removeEventListener('online', reOnline)
      window.removeEventListener('offline', disconnect)
      disconnect()
    }
  }, [currentList])

  // =========================================
  // Mark item checked
  // =========================================
  const markItemChecked = async (item) => {
    const now = new Date().toISOString()

    // Optimistic remove
    setItems(prev => prev.filter(i => i.id !== item.id))
    setSuggestions(prev => [item.name, ...prev.filter(s => s !== item.name)])

    await queueAction({
      table: 'items_new',
      type: 'update',
      data: { checked: true, quantity: 1, updated_at: now },
      match: { id: item.id },
    })
  }

  // =========================================
  // Update quantity
  // =========================================
  const updateItemQuantity = async (itemId, quantity) => {
    const now = new Date().toISOString()

    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, quantity } : i))
    )

    await queueAction({
      table: 'items_new',
      type: 'update',
      data: { quantity, updated_at: now },
      match: { id: itemId },
    })
  }

  // =========================================
  // Long-press handlers (items)
  // =========================================
  const onItemTouchStart = (item) => {
    longPressTriggered.current = false

    touchTimerRef.current = setTimeout(() => {
      longPressTriggered.current = true
      setActiveItem(item)
    }, LONG_PRESS)
  }

  const onItemTouchEnd = (item) => {
    clearTimeout(touchTimerRef.current)

    if (longPressTriggered.current) return

    // Short tap → mark checked
    markItemChecked(item)
  }

  // =========================================
  // Long-press handlers (suggestions)
  // =========================================
  const onSuggestionTouchStart = (name) => {
    suggestionLongPressTriggered.current = false

    suggestionTouchTimerRef.current = setTimeout(() => {
      suggestionLongPressTriggered.current = true

      if (window.confirm(`Delete "${name}" from suggestions?`)) {
        queueAction({
          table: 'items_new',
          type: 'delete',
          match: { name, checked: true },
        })

        setSuggestions(prev => prev.filter(s => s !== name))
      }
    }, LONG_PRESS)
  }

  const onSuggestionTouchEnd = (name) => {
    clearTimeout(suggestionTouchTimerRef.current)

    if (suggestionLongPressTriggered.current) return

    addItem(name)
  }

  // =========================================
  // Add item (clean, no duplicates)
  // =========================================
  const addItem = async (name) => {
    name = name.trim()
    if (!name) return

    if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" is already in your list`)
      return
    }

    const now = new Date().toISOString()
    const newItem = {
      id: crypto.randomUUID(),
      name,
      quantity: 1,
      checked: false,
      list_id: currentList.id,
      updated_at: now,
    }

    // Optimistic UI
    setItems(prev => [...prev, newItem])

    await queueAction({
      table: 'items_new',
      type: 'insert',
      data: [newItem],
    })

    setInput('')
  }

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) &&
      !items.some(i => i.name === s)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-200 text-center text-sm py-1 z-50 shadow">
          ⚠️ Offline — changes will sync later
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-center gap-2 overflow-hidden">
        <CartHeader title={currentList?.name || 'Shopping List'} />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-2xl bg-white shadow rounded-2xl p-4">

        {/* Items Grid */}
        <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map(item => (
            <li
              key={item.id}
              onClick={() => {
                if (!longPressTriggered.current) {
                  markItemChecked(item)
                }
              }}
              onTouchStart={() => onItemTouchStart(item)}
              onTouchEnd={() => onItemTouchEnd(item)}
              onTouchCancel={() => onItemTouchEnd(item)}
              onContextMenu={(e) => {
                e.preventDefault()
                setActiveItem(item)
              }}
              className="relative bg-customGreen text-white font-semibold flex flex-col items-center justify-center h-24 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
            >
              {item.name.split(' ').map((word, idx) => (
                <FitText key={idx} text={word} maxFont={20} minFont={10} padding={16} />
              ))}
              {item.quantity > 1 && (
                <div className="absolute top-1 right-1 bg-white text-customGreen text-xs font-bold rounded-full px-2 py-0.5">
                  {item.quantity}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Quantity dialog */}
        {activeItem && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white p-4 rounded-xl shadow w-64 text-center">
              <h2 className="text-lg font-semibold mb-2">{activeItem.name}</h2>

              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      updateItemQuantity(activeItem.id, q)
                      setActiveItem(null)
                    }}
                    className="bg-customGreen text-white rounded-full w-8 h-8"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                placeholder="Custom quantity"
                className="border rounded px-2 py-1 w-full mb-3"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const value = parseInt(e.target.value)
                    if (value > 0) {
                      updateItemQuantity(activeItem.id, value)
                      setActiveItem(null)
                    }
                  }
                }}
              />

              <button className="text-gray-500 underline text-sm" onClick={() => setActiveItem(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add item */}
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

        {/* Suggestions */}
        {filteredSuggestions.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {filteredSuggestions.map(name => (
              <li
                key={name}
                onClick={() => {
                  // Prevent click after long-press delete
                  if (!suggestionLongPressTriggered.current) {
                    addItem(name)
                  }
                }}
                onTouchStart={() => onSuggestionTouchStart(name)}
                onTouchEnd={() => onSuggestionTouchEnd(name)}
                onTouchCancel={() => {
                  clearTimeout(suggestionTouchTimerRef.current)
                  suggestionLongPressTriggered.current = false
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (window.confirm(`Delete "${name}"?`)) {
                    queueAction({
                      table: 'items_new',
                      type: 'delete',
                      match: { name, checked: true },
                    })
                    setSuggestions(prev => prev.filter(s => s !== name))
                  }
                }}
                className="bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg cursor-pointer shadow hover:scale-105 p-2 select-none"
              >

                {name.split(' ').map((word, idx) => (
                  <FitText key={idx} text={word} maxFont={18} minFont={10} padding={16} />
                ))}
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  )
}
