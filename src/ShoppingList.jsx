import { useEffect, useState } from 'react'
import FitText from './FitText'
import CartHeader from './CartHeader'
import useLongPress from "./useLongPress"

export default function ShoppingList({ supabase, user, currentList }) {
  const [items, setItems] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [input, setInput] = useState('')
  const [activeItem, setActiveItem] = useState(null)
  const [dbWarning, setDbWarning] = useState(false)

  // unified long-press handlers
  const { bind: bindItem } = useLongPress()
  const { bind: bindSuggestion } = useLongPress()

  // -------------------------------------------------
  // DB slow warning wrapper
  // -------------------------------------------------
  const runDb = async (promise) => {
    let timeoutId

    const slow = new Promise(resolve => {
      timeoutId = setTimeout(() => {
        setDbWarning(true)
        resolve("slow")
      }, 3000)
    })

    const result = await Promise.race([promise, slow])

    clearTimeout(timeoutId)
    if (result !== "slow") setDbWarning(false)
    return result
  }

  // -------------------------------------------------
  // Fetch data
  // -------------------------------------------------
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
      .select('id, name')
      .eq('list_id', currentList.id)
      .eq('checked', true)
      .order('updated_at', { ascending: false })
    setSuggestions(data || [])
  }

  // -------------------------------------------------
  // Realtime
  // -------------------------------------------------
  useEffect(() => {
    if (!currentList) return

    let channel = supabase
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

    fetchItems()
    fetchSuggestions()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [currentList])


  // -------------------------------------------------
  // Item actions
  // -------------------------------------------------
  const markChecked = async (item) => {
    const now = new Date().toISOString()

    setItems(prev => prev.filter(i => i.id !== item.id))
    setSuggestions(prev => [
      { id: item.id, name: item.name },
      ...prev.filter(s => s.name !== item.name),
    ])

    await runDb(
      supabase
        .from('items_new')
        .update({ checked: true, quantity: 1, updated_at: now })
        .eq('id', item.id)
    )
  }

  const updateQuantity = async (itemId, quantity) => {
    const now = new Date().toISOString()
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, quantity } : i
    ))
    await runDb(
      supabase
        .from('items_new')
        .update({ quantity, updated_at: now })
        .eq('id', itemId)
    )
  }

  const addItem = async (name) => {
    name = name.trim()
    if (!name) return

    const now = new Date().toISOString()

    if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" is already in the list.`)
      return
    }

    const existing = suggestions.find(
      s => s.name.toLowerCase() === name.toLowerCase()
    )

    if (existing) {
      setSuggestions(prev => prev.filter(s => s.id !== existing.id))

      const restored = {
        id: existing.id,
        name,
        quantity: 1,
        checked: false,
        list_id: currentList.id,
        updated_at: now,
      }
      setItems(prev => [...prev, restored])

      await runDb(
        supabase
          .from('items_new')
          .update({ checked: false, quantity: 1, updated_at: now })
          .eq('id', existing.id)
      )

      setInput('')
      return
    }

    const newItem = {
      id: crypto.randomUUID(),
      name,
      quantity: 1,
      checked: false,
      list_id: currentList.id,
      updated_at: now,
    }

    setItems(prev => [...prev, newItem])

    await runDb(
      supabase
        .from('items_new')
        .insert([newItem])
    )

    setInput('')
  }

  // -------------------------------------------------
  // Filter suggestions
  // -------------------------------------------------
  const filteredSuggestions = suggestions.filter(
    s =>
      s.name.toLowerCase().includes(input.toLowerCase()) &&
      !items.some(i => i.name === s.name)
  )

  // -------------------------------------------------
  // Render
  // -------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">

      {dbWarning && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-300 text-center py-2 z-50 font-semibold shadow">
          We're having trouble locating your list in the cloud — maybe you're offline.
        </div>
      )}

      <div className="flex justify-center mb-4">
        <CartHeader title={currentList?.name || 'Shopping List'} />
      </div>

      <div className="w-full max-w-2xl bg-white p-4 rounded-2xl shadow">

        {/* ITEMS */}
        <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map(item => (
            <li
              key={item.id}
              {...bindItem({
                onLongPress: () => setActiveItem(item),
                onTap: () => markChecked(item),
                onRightClick: () => setActiveItem(item)
              })}
              className="relative bg-customGreen text-white font-bold flex flex-col items-center justify-center h-24 rounded-lg shadow cursor-pointer select-none hover:scale-105 transition-transform"
            >
              {item.name.split(' ').map((w, i) => (
                <FitText key={i} text={w} maxFont={20} minFont={10} padding={16} />
              ))}
              {item.quantity > 1 && (
                <div className="absolute top-1 right-1 bg-white text-customGreen font-bold text-xs px-2 py-0.5 rounded-full">
                  {item.quantity}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* QUANTITY MODAL */}
        {activeItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow p-4 w-64 text-center">
              <h2 className="text-lg font-semibold mb-2">{activeItem.name}</h2>
              <div className="flex justify-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      updateQuantity(activeItem.id, q)
                      setActiveItem(null)
                    }}
                    className="bg-customGreen text-white w-8 h-8 rounded-full"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                className="border rounded px-2 py-1 w-full mb-3"
                placeholder="Custom"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = parseInt(e.target.value)
                    if (v > 0) {
                      updateQuantity(activeItem.id, v)
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

        {/* ADD ITEM */}
        <div className="flex gap-0 mt-4 mb-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem(input)}
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

        {/* SUGGESTIONS */}
        {filteredSuggestions.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {filteredSuggestions.map(s => (
              <li
                key={s.id}
                {...bindSuggestion({
                  onLongPress: () => {
                    if (window.confirm(`Delete "${s.name}" from history?`)) {
                      runDb(supabase.from("items_new").delete().eq("id", s.id))
                      setSuggestions(prev => prev.filter(x => x.id !== s.id))
                    }
                  },
                  onTap: () => addItem(s.name),
                  onRightClick: () => {
                    if (window.confirm(`Delete "${s.name}"?`)) {
                      runDb(supabase.from("items_new").delete().eq("id", s.id))
                      setSuggestions(prev => prev.filter(x => x.id !== s.id))
                    }
                  }
                })}
                className="bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg shadow cursor-pointer select-none hover:scale-105 transition-transform"
              >
                {s.name.split(' ').map((w, i) => (
                  <FitText key={i} text={w} maxFont={18} minFont={10} padding={16} />
                ))}
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  )
}
