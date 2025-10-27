import { useEffect, useState } from 'react'
import FitText from './FitText'

export default function ShoppingList({ supabase, user }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])

  // Fetch current list
  useEffect(() => {
    fetchItems()        // initial fetch
    fetchSuggestions()  // load autocomplete suggestions

    // Poll the items table every 2 seconds
    const interval = setInterval(fetchItems, 2000)

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval)
  }, [])

  const fetchItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: true })
    setItems(data || [])
  }


  
  const fetchSuggestions = async () => {
    const { data } = await supabase.from('past_items').select('name')
    setSuggestions(data?.map(d => d.name) || [])
  }

  const addItem = async name => {
    if (!name.trim()) return
    await supabase.from('items').insert([{ name }])
    await supabase.from('past_items').upsert([{ name }])
    setInput('')
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
              className="bg-green-500 text-white font-semibold flex flex-col items-center justify-center h-24 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2"
            >
              {item.name.split(' ').map((word, i) => (
                <FitText key={i} text={word} maxFont={20} minFont={10} padding={16} />
              ))}
            </li>
          ))}
        </ul>

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
            className="bg-green-500 text-white px-4 rounded-r-lg"
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
          className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg cursor-pointer shadow hover:scale-105 transition-transform p-2"
          onClick={async () => await addItem(name)}
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
