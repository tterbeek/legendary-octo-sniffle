import { useEffect, useMemo, useRef, useState } from 'react'
import FitText from './FitText'
import CartHeader from './CartHeader'
import EditItemDialog from './EditItemDialog'
import useLongPress from "./useLongPress"

export default function ShoppingList({ supabase, user, currentList, onShareList, shareLoading = false }) {
  const [items, setItems] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [input, setInput] = useState('')
  const [activeItem, setActiveItem] = useState(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [maxRecent, setMaxRecent] = useState(3)
  const [dbWarning, setDbWarning] = useState(false)
  const [memberCount, setMemberCount] = useState(null)
  const [actionCount, setActionCount] = useState(0)
  const [checkedCount, setCheckedCount] = useState(0)
  const [showTip1, setShowTip1] = useState(false)
  const [tip1TargetId, setTip1TargetId] = useState(null)
  const [showTip2, setShowTip2] = useState(false)
  const [tip2TargetId, setTip2TargetId] = useState(null)
  const [showTip3, setShowTip3] = useState(false)
  const [tipActionLabel, setTipActionLabel] = useState('Long-press')
  const tipKeys = {
    tip1: 'groc_tip1_shown',
    tip2: 'groc_tip2_shown',
    tip3: 'groc_tip3_shown',
    actions: 'groc_tip_actions',
    checked: 'groc_tip_checked'
  }

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
  // Init persisted counts & flags
  useEffect(() => {
    try {
      const storedActions = parseInt(localStorage.getItem(tipKeys.actions) || '0', 10)
      if (!Number.isNaN(storedActions)) setActionCount(storedActions)
      const storedChecked = parseInt(localStorage.getItem(tipKeys.checked) || '0', 10)
      if (!Number.isNaN(storedChecked)) setCheckedCount(storedChecked)
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia("(pointer:fine)")
    const update = () => {
      setTipActionLabel(mql.matches ? "Right-click" : "Long-press")
    }
    update()
    if (mql.addEventListener) {
      mql.addEventListener("change", update)
    } else {
      mql.addListener(update)
    }
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", update)
      } else {
        mql.removeListener(update)
      }
    }
  }, [])

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
      .select('id, name, category, list_id, updated_at')
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
  const recordAction = (increment = 1) => {
    setActionCount(prev => {
      const next = prev + increment
      try {
        localStorage.setItem(tipKeys.actions, String(next))
        if (next >= 5 && !localStorage.getItem('groc_support_opened')) {
          localStorage.setItem('groc_support_pending', '1')
          window.dispatchEvent(new CustomEvent('open-support-modal'))
        }
      } catch {}
      return next
    })
  }

  const recordChecked = () => {
    setCheckedCount(prev => {
      const next = prev + 1
      try {
        localStorage.setItem(tipKeys.checked, String(next))
      } catch {}
      if (next === 1 && !localStorage.getItem(tipKeys.tip2)) {
        setTip2TargetId(lastCheckedIdRef.current)
        setShowTip2(true)
        localStorage.setItem(tipKeys.tip2, '1')
      }
      if (next === 3 && !localStorage.getItem(tipKeys.tip3)) {
        setShowTip3(true)
        localStorage.setItem(tipKeys.tip3, '1')
      }
      return next
    })
  }

  const lastCheckedIdRef = useRef(null)

  const markChecked = async (item) => {
    const now = new Date().toISOString()

    setItems(prev => prev.filter(i => i.id !== item.id))
    setSuggestions(prev => [
      {
        id: item.id,
        name: item.name,
        category: item.category ?? null,
        list_id: item.list_id,
        updated_at: now,
        checked: true
      },
      ...prev.filter(s => s.id !== item.id),
    ])

    await runDb(
      supabase
        .from('items_new')
        .update({ checked: true, quantity: 1, updated_at: now })
        .eq('id', item.id)
    )

    lastCheckedIdRef.current = item.id
    recordChecked()
    recordAction()
  }

  const openEditDialog = (item) => {
    setEditItem(item)
    setEditDialogOpen(true)
  }

  const closeEditDialog = () => {
    setEditDialogOpen(false)
    setEditItem(null)
  }

  const saveEdit = async ({ id, name, category }) => {
    const now = new Date().toISOString()
    const updatePromise = supabase
      .from('items_new')
      .update({ name, category, updated_at: now })
      .eq('id', id)

    const result = await runDb(updatePromise)
    const finalResult = result === "slow" ? await updatePromise : result

    if (finalResult?.error) throw finalResult.error

    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, name, category } : i)
    )
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, name, category } : s)
    )
  }

  const deleteItem = async (id) => {
    const deletePromise = supabase.from("items_new").delete().eq("id", id)
    const result = await runDb(deletePromise)
    const finalResult = result === "slow" ? await deletePromise : result

    if (finalResult?.error) throw finalResult.error

    setItems(prev => prev.filter(i => i.id !== id))
    setSuggestions(prev => prev.filter(s => s.id !== id))
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

    recordAction()
  }

  const addItem = async (name) => {
    name = name.trim()
    if (!name) return

    const now = new Date().toISOString()
    const wasEmpty = items.length === 0

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
        category: existing.category ?? null,
        list_id: existing.list_id || currentList.id,
        updated_at: now,
      }
      setItems(prev => [...prev, restored])

      await runDb(
        supabase
          .from('items_new')
          .update({ checked: false, quantity: 1, updated_at: now })
          .eq('id', existing.id)
      )

      if (!localStorage.getItem(tipKeys.tip1)) {
        setTip1TargetId(restored.id)
        setShowTip1(true)
        localStorage.setItem(tipKeys.tip1, '1')
      }

      recordAction()
      setInput('')
      return
    }

    const newItem = {
      id: crypto.randomUUID(),
      name,
      quantity: 1,
      checked: false,
      category: null,
      list_id: currentList.id,
      updated_at: now,
    }

    setItems(prev => [...prev, newItem])

    await runDb(
      supabase
        .from('items_new')
        .insert([newItem])
    )

    if (!localStorage.getItem(tipKeys.tip1)) {
      setTip1TargetId(newItem.id)
      setShowTip1(true)
      localStorage.setItem(tipKeys.tip1, '1')
    }

    recordAction()
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
  // Responsive recent count
  // -------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mediaQuery = window.matchMedia("(min-width: 640px)")
    const update = () => setMaxRecent(mediaQuery.matches ? 4 : 3)
    update()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", update)
    } else {
      mediaQuery.addListener(update)
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", update)
      } else {
        mediaQuery.removeListener(update)
      }
    }
  }, [])

  useEffect(() => {
    if (!currentList) {
      setMemberCount(null)
      return
    }

    let canceled = false

    const fetchMemberCount = async () => {
      const { data, error } = await supabase
        .from('list_members')
        .select('user_id')
        .eq('list_id', currentList.id)

      if (canceled) return

      if (error) {
        console.error('Failed to fetch member count', {
          listId: currentList.id,
          error
        })
        setMemberCount(null)
        return
      }

      const memberIds = new Set()
      if (currentList.owner_id) memberIds.add(currentList.owner_id)
      ;(data || []).forEach(row => {
        if (row?.user_id) memberIds.add(row.user_id)
      })

      setMemberCount(memberIds.size || null)
    }

    fetchMemberCount()

    return () => {
      canceled = true
    }
  }, [currentList, supabase, user?.id])

  // -------------------------------------------------
  // Derived data
  // -------------------------------------------------
  const categories = useMemo(() => {
    const unique = new Set()
    ;[...items, ...suggestions].forEach(entry => {
      if (entry?.category) unique.add(entry.category)
    })
    return Array.from(unique)
  }, [items, suggestions])
  const hasCategories = categories.length > 0

  const recentSuggestions = useMemo(() => {
    const sorted = [...filteredSuggestions].sort(
      (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    )
    return sorted.slice(0, maxRecent)
  }, [filteredSuggestions, maxRecent])

  const normalizedCategory = (cat) => {
    if (!cat) return null
    const trimmed = cat.trim()
    if (!trimmed) return null
    return trimmed.toLowerCase()
  }

  const groupedSuggestions = useMemo(() => {
    const groups = new Map()
    filteredSuggestions.forEach(item => {
      const normalized = normalizedCategory(item.category)
      if (!normalized) return
      const displayName = (item.category || "").trim()
      if (!groups.has(normalized)) {
        groups.set(normalized, { name: displayName, items: [] })
      }
      groups.get(normalized).items.push(item)
    })

    return Array.from(groups.values()).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    )
  }, [filteredSuggestions])

  const uncategorizedSuggestions = useMemo(
    () => filteredSuggestions
      .filter(item => !normalizedCategory(item.category))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [filteredSuggestions]
  )

  useEffect(() => {
    if (!editDialogOpen || !editItem) return
    const stillExists =
      items.some(i => i.id === editItem.id) ||
      suggestions.some(s => s.id === editItem.id)

    if (!stillExists) {
      setEditDialogOpen(false)
      setEditItem(null)
    }
  }, [items, suggestions, editDialogOpen, editItem])

  useEffect(() => {
    if (!activeItem) return
    const stillExists = items.some(i => i.id === activeItem.id)
    if (!stillExists) setActiveItem(null)
  }, [items, activeItem])

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

      <div className="w-full max-w-2xl mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 flex justify-center">
            <CartHeader title={currentList?.name || 'Shopping List'} />
          </div>
          <div className="flex-shrink-0 flex items-center justify-end mt-[-4px] relative">
            <button
              onClick={() => onShareList?.(currentList)}
              disabled={!currentList || shareLoading}
              className="p-3 text-customGreen hover:text-customGreen rounded-full disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-customGreen/30 transition-colors"
              aria-label="Share list"
            >
              <span className="flex items-center gap-1">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
                </svg>
                {memberCount > 1 && (
                  <span className="text-sm font-semibold text-gray-700">{memberCount}</span>
                )}
              </span>
            </button>
            {showTip3 && (
              <div className="absolute top-full right-0 mt-1 z-20 bg-white text-gray-800 text-xs px-4 py-3 rounded shadow border border-gray-200 w-80 text-left">
                Share this list to sync with others in real time
                <button
                  className="ml-2 text-customGreen"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowTip3(false)
                  }}
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
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
              {showTip1 && item.id === tip1TargetId && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-white text-gray-800 text-xs px-4 py-3 rounded shadow border border-gray-200 w-80 text-left"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  Tip: {tipActionLabel} an item to add a quantity
                  <button
                    className="ml-2 text-customGreen"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowTip1(false)
                    }}
                  >
                    Got it
                  </button>
                </div>
              )}
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
          <div className="mt-2 space-y-4">
            {recentSuggestions.length > 0 && (
              <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">Recently used items</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {recentSuggestions.map(s => (
                    <div
                      key={`recent-${s.id}`}
                      {...bindSuggestion({
                        onLongPress: () => openEditDialog(s),
                        onTap: () => addItem(s.name),
                        onRightClick: () => openEditDialog(s)
                      })}
                    className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg shadow cursor-pointer select-none hover:scale-105 transition-transform"
                  >
                    {showTip2 && s.id === tip2TargetId && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-white text-gray-800 text-xs px-4 py-3 rounded shadow border border-gray-200 w-80 text-left"
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                      >
                        Tip: {tipActionLabel} an item to add a category
                        <button
                          className="ml-2 text-customGreen"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowTip2(false)
                          }}
                        >
                          Got it
                        </button>
                      </div>
                    )}
                    {s.name.split(' ').map((w, i) => (
                      <FitText key={i} text={w} maxFont={18} minFont={10} padding={16} />
                    ))}
                  </div>
                ))}
                </div>
              </div>
            )}

            {groupedSuggestions.map(group => (
              <div key={group.name}>
                <div className="text-sm font-semibold text-gray-600 mb-1">{group.name}</div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {group.items
                    .slice()
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                    {...bindSuggestion({
                      onLongPress: () => openEditDialog(item),
                      onTap: () => addItem(item.name),
                      onRightClick: () => openEditDialog(item)
                    })}
                    className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg shadow cursor-pointer select-none hover:scale-105 transition-transform"
                  >
                        {item.name.split(' ').map((w, i) => (
                          <FitText key={i} text={w} maxFont={18} minFont={10} padding={16} />
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {uncategorizedSuggestions.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">
                  {hasCategories ? "Other uncategorized items" : "All items"}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {uncategorizedSuggestions.map(item => (
                    <div
                      key={item.id}
                      {...bindSuggestion({
                        onLongPress: () => openEditDialog(item),
                        onTap: () => addItem(item.name),
                        onRightClick: () => openEditDialog(item)
                      })}
                      className="relative bg-gray-400 text-white font-semibold flex flex-col items-center justify-center h-20 rounded-lg shadow cursor-pointer select-none hover:scale-105 transition-transform"
                    >
                        {item.name.split(' ').map((w, i) => (
                          <FitText key={i} text={w} maxFont={18} minFont={10} padding={16} />
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      <EditItemDialog
        open={editDialogOpen}
        item={editItem}
        categories={categories}
        onSave={saveEdit}
        onDelete={deleteItem}
        onClose={closeEditDialog}
      />
    </div>
  )
}
