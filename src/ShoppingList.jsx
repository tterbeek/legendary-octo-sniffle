import { useEffect, useState } from 'react'
import FitText from './FitText'

export default function ShoppingList({ supabase, user }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeItem, setActiveItem] = useState(null)

  let timer;

  // Fetch current list
  useEffect(() => {
    fetchItems()        // initial fetch
    fetchSuggestions()  // load autocomplete suggestions

    // ✅ Subscribe to realtime changes on the items table
    const channel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        payload => {
          console.log('Realtime change:', payload)

          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new])
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev.map(i => (i.id === payload.new.id ? payload.new : i))
            )
          }
        }
      )
      .subscribe()

    // Cleanup when component unmounts
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: true })
    setItems(data || [])
  }

  const handlePressStart = (item) => {
    timer = setTimeout(() => setActiveItem(item), 800)
    }

  const handlePressEnd = () => clearTimeout(timer)

  
  const fetchSuggestions = async () => {
    const { data } = await supabase.from('past_items').select('name')
    setSuggestions(data?.map(d => d.name) || [])
  }

  const addItem = async name => {
    name = name.trim()
    if (!name) return

    // Prevent duplicates in current items
    const exists = items.some(i => i.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      alert(`"${name}" is already in your shopping list.`)
      return
    }

    // Insert into Supabase
    await supabase.from('items').insert([{ name, quantity: 1 }])
    await supabase.from('past_items').upsert([{ name }])
    setInput('')

    // Optionally, fetch the latest items to sync
    fetchItems()
  }


  // Compute filtered suggestions dynamically based on input and current items
  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !items.some(i => i.name === s)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">🛒 Shared Shopping List</h1>

      <div className="w-full max-w-2xl bg-white shadow rounded-2xl p-4">

{/* Shopping List Grid */}
<ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
  {items.map(item => (
    <li
      key={item.id}
      onClick={async () => {
        setItems(prev => prev.filter(i => i.id !== item.id))
        await supabase.from('items').delete().eq('id', item.id)
      }}
      onMouseDown={() => handlePressStart(item)}
      onMouseUp={handlePressEnd}
      onTouchStart={() => handlePressStart(item)}
      onTouchEnd={handlePressEnd}
      className="relative bg-customGreen text-white font-semibold flex flex-col items-center justify-center h-24 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
      style={{
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
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

 {/* Dialog for quantity */} 
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
                  setItems(prev =>
                    prev.map(i => (i.id === activeItem.id ? { ...i, quantity: num } : i))
                  )
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
                  setItems(prev =>
                    prev.map(i => (i.id === activeItem.id ? { ...i, quantity: num } : i))
                  )
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



        {/* Search Input */}
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
          let timer;

          const handlePressStart = (e) => {
            e.preventDefault();
            timer = setTimeout(async () => {
              const confirmed = window.confirm(`Delete "${name}" from suggestions?`)
              if (confirmed) {
                await supabase.from('past_items').delete().eq('name', name)
                setSuggestions(prev => prev.filter(s => s !== name))
              }
            }, 800);
          }

          const handlePressEnd = () => {
            clearTimeout(timer);
          }

          return (
            <li
              key={name}
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              onClick={async () => await addItem(name)}
              className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2 select-none"
              style={{
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }}
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