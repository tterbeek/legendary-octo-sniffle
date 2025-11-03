import { useEffect, useState, useRef } from 'react'
import FitText from './FitText'

export default function ShoppingList({ supabase, user, currentList }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeItem, setActiveItem] = useState(null)
  const touchTimerRef = useRef(null)
  const touchThreshold = 800 // ms for long press
  const suggestionTouchTimerRef = useRef(null)
  const suggestionTouchThreshold = 800



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

    fetchItems()
    fetchSuggestions()

    const channel = supabase
      .channel(`items-new-changes-${currentList.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items_new',
          filter: `list_id=eq.${currentList.id}`
        },
        payload => {
          const newItem = payload.new
          const oldItem = payload.old

          if (payload.eventType === 'INSERT') {
            if (!newItem.checked) {
              setItems(prev => {
                if (prev.some(i => i.id === newItem.id)) return prev
                return [...prev, newItem].sort(
                  (a, b) => new Date(a.created_at) - new Date(b.created_at)
                )
              })
            } else {
              setSuggestions(prev => [newItem.name, ...prev.filter(s => s !== newItem.name)])
            }
          } else if (payload.eventType === 'UPDATE') {
            if (newItem.checked) {
              setItems(prev => prev.filter(i => i.id !== newItem.id))
              setSuggestions(prev => [newItem.name, ...prev.filter(s => s !== newItem.name)])
            } else {
              setItems(prev =>
                prev
                  .map(i => (i.id === newItem.id ? newItem : i))
                  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== oldItem.id))
            setSuggestions(prev => prev.filter(s => s !== oldItem.name))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentList])


    const markItemChecked = async (item) => {
      // Optimistic UI
      setItems(prev => prev.filter(i => i.id !== item.id))
      setSuggestions(prev => [item.name, ...prev.filter(s => s !== item.name)])

      // Update database: mark checked and reset quantity
      await supabase
        .from('items_new')
        .update({ checked: true, quantity: 1 })
        .eq('id', item.id)
    }



  // -----------------------------
  // Touch handlers
  // -----------------------------
  const handleTouchStart = item => {
    touchTimerRef.current = setTimeout(() => {
      setActiveItem(item)
      touchTimerRef.current = null
    }, touchThreshold)
  }

    const handleTouchEnd = async (item) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
      await markItemChecked(item)
      }
    }

  // Long press for delete
const handleSuggestionTouchStart = name => {
  suggestionTouchTimerRef.current = setTimeout(async () => {
    if (window.confirm(`Delete "${name}" from suggestions?`)) {
      await supabase
        .from('items_new')
        .update({ checked: false }) // optional: keep it checked = false
        .eq('name', name)
      setSuggestions(prev => prev.filter(s => s !== name))
    }
    suggestionTouchTimerRef.current = null
  }, suggestionTouchThreshold)
}

const handleSuggestionTouchEnd = () => {
  if (suggestionTouchTimerRef.current) {
    clearTimeout(suggestionTouchTimerRef.current)
    suggestionTouchTimerRef.current = null
  }
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
        .update({ checked: false })
        .eq('name', name)
      setSuggestions(prev => prev.filter(s => s !== name))
    }
  }



  // -----------------------------
  // Add item
  // -----------------------------
  const addItem = async name => {
    name = name.trim()
    if (!name) return

    if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" is already in your shopping list.`)
      return
    }

    try {
      const { data: existing } = await supabase
        .from('items_new')
        .select('*')
        .eq('list_id', currentList.id)
        .ilike('name', name)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('items_new')
          .update({ checked: false })
          .eq('id', existing.id)

        setItems(prev => [...prev, { ...existing, checked: false }])
      } else {
        const { data: inserted } = await supabase
          .from('items_new')
          .insert([{ name, quantity: 1, list_id: currentList.id }])
          .select()
        if (inserted?.length) setItems(prev => [...prev, inserted[0]])
      }

      setInput('')
    } catch (err) {
      console.error('Error adding item:', err)
    }
  }

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !items.some(i => i.name === s)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">
        🛒 {currentList?.name || 'Shopping List'}
      </h1>

      <div className="w-full max-w-2xl bg-white shadow rounded-2xl p-4">
        {/* Shopping List Grid */}
        <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map(item => (
            <li
              key={item.id}
              onContextMenu={e => handleRightClick(e, item)}
              onTouchStart={() => handleTouchStart(item)}
              onTouchEnd={() => handleTouchEnd(item)}
              onTouchCancel={() => handleTouchEnd(item)}
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
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={async () => {
                      // Optimistic UI: update local state immediately
                      setItems(prev =>
                        prev.map(i =>
                          i.id === activeItem.id ? { ...i, quantity: num } : i
                        )
                      )

                      // Update database
                      await supabase
                        .from('items_new')
                        .update({ quantity: num })
                        .eq('id', activeItem.id)

                      setActiveItem(null)
                    }}
                    className="bg-customGreen text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-customGreen/80"
                  >
                    {num}
                  </button>
                ))}

              </div>
              <input
                type="number"
                min="1"
                placeholder="Custom number"
                className="border rounded px-2 py-1 w-full mb-3"
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    const num = parseInt(e.target.value)
                    if (!isNaN(num) && num > 0) {
                      // Optimistic UI
                      setItems(prev =>
                        prev.map(i =>
                          i.id === activeItem.id ? { ...i, quantity: num } : i
                        )
                      )

                      // Update database
                      await supabase
                        .from('items_new')
                        .update({ quantity: num })
                        .eq('id', activeItem.id)

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
              onContextMenu={e => handleSuggestionRightClick(e, name)} // desktop right-click
              onTouchStart={() => handleSuggestionTouchStart(name)}  // touch long press
              onTouchEnd={handleSuggestionTouchEnd}
              onTouchCancel={handleSuggestionTouchEnd}
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
