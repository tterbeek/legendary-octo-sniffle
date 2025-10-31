import { useEffect, useState } from 'react'
import FitText from './FitText'

export default function ShoppingList({ supabase, user, currentList }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeItem, setActiveItem] = useState(null)

  let timer

  // -----------------------------
  // Fetch items and suggestions
  // -----------------------------
  const fetchItems = async () => {
    if (!currentList) return
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', currentList.id)
      .order('created_at', { ascending: true })
    if (error) console.error('Error fetching items:', error)
    else setItems(data || [])
  }

  const fetchSuggestions = async () => {
    if (!currentList) return
    const { data, error } = await supabase
      .from('past_items')
      .select('name, updated_at')
      .eq('list_id', currentList.id)
      .order('updated_at', { ascending: false })
    if (error) console.error('Error fetching suggestions:', error)
    else setSuggestions(data?.map(d => d.name) || [])
  }

  // -----------------------------
  // Handle realtime updates
  // -----------------------------
  useEffect(() => {
    if (!currentList) return

    // Initial fetch
    fetchItems()
    fetchSuggestions()

    // Items realtime channel
    const channelItems = supabase
      .channel(`items-changes-${currentList.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `list_id=eq.${currentList.id}`
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              if (prev.some(i => i.id === payload.new.id)) return prev
              return [...prev, payload.new].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              )
            })
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev
                .map(i => (i.id === payload.new.id ? payload.new : i))
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            )
          }
        }
      )
      .subscribe()

    // Past items (suggestions) realtime channel
    const channelPast = supabase
      .channel(`past-items-changes-${currentList.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'past_items',
          filter: `list_id=eq.${currentList.id}`
        },
        payload => {
          fetchSuggestions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelItems)
      supabase.removeChannel(channelPast)
    }
  }, [currentList])

  // -----------------------------
  // Long press handlers
  // -----------------------------
  const handlePressStart = item => {
    timer = setTimeout(() => setActiveItem(item), 800)
  }

  const handlePressEnd = () => clearTimeout(timer)

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
      await supabase.from('items').insert([{ name, quantity: 1, list_id: currentList.id }])
      await supabase.from('past_items').upsert([{ name, list_id: currentList.id }])
      setInput('')
      // No need to fetchItems(); realtime will update automatically
    } catch (err) {
      console.error('Error adding item:', err)
    }
  }

  // -----------------------------
  // Filter suggestions dynamically
  // -----------------------------
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
              onClick={async () => {
                // Remove from shopping list
                setItems(prev => prev.filter(i => i.id !== item.id))
                await supabase.from('items').delete().eq('id', item.id)
                // Update suggestions
                setSuggestions(prev => [item.name, ...prev.filter(s => s !== item.name)])
                await supabase.from('past_items').upsert([{ name: item.name, list_id: currentList.id, updated_at: new Date().toISOString() }])
              }}
              onMouseDown={() => handlePressStart(item)}
              onMouseUp={handlePressEnd}
              onTouchStart={() => handlePressStart(item)}
              onTouchEnd={handlePressEnd}
              className="relative bg-customGreen text-white font-semibold flex flex-col items-center justify-center h-24 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
              style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            >
              {item.name.split(' ').map((word, i) => (
                <FitText key={i} text={word} maxFont={20} minFont={10} padding={16} />
              ))}
              {item.quantity > 1 && (
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
                      await supabase.from('items').update({ quantity: num }).eq('id', activeItem.id)
                      setItems(prev => prev.map(i => (i.id === activeItem.id ? { ...i, quantity: num } : i)))
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
                      await supabase.from('items').update({ quantity: num }).eq('id', activeItem.id)
                      setItems(prev => prev.map(i => (i.id === activeItem.id ? { ...i, quantity: num } : i)))
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
            {filteredSuggestions.map(name => {
              let timer
              const handlePressStart = e => {
                e.preventDefault()
                timer = setTimeout(async () => {
                  if (window.confirm(`Delete "${name}" from suggestions?`)) {
                    await supabase.from('past_items').delete().eq('name', name).eq('list_id', currentList.id)
                    setSuggestions(prev => prev.filter(s => s !== name))
                  }
                }, 800)
              }
              const handlePressEnd = () => clearTimeout(timer)

              return (
                <li
                  key={name}
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  onClick={async () => addItem(name)}
                  className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
                  style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                >
                  {name.split(' ').map((word, i) => (
                    <FitText key={i} text={word} maxFont={18} minFont={10} padding={16} />
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
