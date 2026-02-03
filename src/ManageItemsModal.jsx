import { useEffect, useMemo, useState } from 'react'

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const normalizeCategory = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

const compareByNameThenId = (a, b) => {
  const nameCompare = collator.compare((a.name || '').trim(), (b.name || '').trim())
  if (nameCompare !== 0) return nameCompare
  return collator.compare(String(a.id), String(b.id))
}

export default function ManageItemsModal({
  open,
  listName,
  listId,
  supabase,
  onClose
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sortMode, setSortMode] = useState('alphabetical')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [categoryInput, setCategoryInput] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    if (!open || !listId) return

    let canceled = false
    const fetchItems = async () => {
      setLoading(true)
      setError(null)
      setSelectedIds(new Set())
      setShowCategoryDialog(false)
      setShowCategorySuggestions(false)
      setCategoryInput('')

      const { data, error: fetchError } = await supabase
        .from('items_new')
        .select('id, name, category')
        .eq('list_id', listId)

      if (canceled) return

      if (fetchError) {
        setItems([])
        setError(fetchError.message || 'Failed to load items.')
      } else {
        setItems(data || [])
      }

      setLoading(false)
    }

    fetchItems()
    return () => {
      canceled = true
    }
  }, [open, listId, supabase])

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = setTimeout(() => setToastMessage(''), 2200)
    return () => clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (showCategoryDialog) {
        setShowCategoryDialog(false)
        setShowCategorySuggestions(false)
        return
      }
      onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, showCategoryDialog, onClose])

  const selectedCount = selectedIds.size
  const canRunActions = selectedCount > 0 && !actionBusy && !categorySaving

  const existingCategories = useMemo(() => {
    const unique = new Map()
    items.forEach((item) => {
      if (!item?.category) return
      const normalized = normalizeCategory(item.category)
      if (!normalized) return
      if (!unique.has(normalized)) {
        unique.set(normalized, item.category.trim())
      }
    })
    return Array.from(unique.values()).sort((a, b) => collator.compare(a, b))
  }, [items])

  const filteredCategories = useMemo(() => {
    const query = categoryInput.trim().toLowerCase()
    if (!query || query.length < 1) return existingCategories
    return existingCategories.filter((category) => category.toLowerCase().includes(query))
  }, [categoryInput, existingCategories])

  const closeCategoryDialog = () => {
    setShowCategoryDialog(false)
    setShowCategorySuggestions(false)
  }

  const groupedItems = useMemo(() => {
    const sorted = [...items].sort(compareByNameThenId)

    if (sortMode === 'alphabetical') {
      return [{ id: 'alphabetical', title: null, items: sorted }]
    }

    const byCategory = new Map()
    const uncategorized = []

    sorted.forEach((item) => {
      const normalized = normalizeCategory(item.category)
      if (!normalized) {
        uncategorized.push(item)
        return
      }

      if (!byCategory.has(normalized)) {
        byCategory.set(normalized, {
          id: normalized,
          title: item.category.trim(),
          items: []
        })
      }

      byCategory.get(normalized).items.push(item)
    })

    const groups = Array.from(byCategory.values()).sort((a, b) => {
      const groupCompare = collator.compare(a.title, b.title)
      if (groupCompare !== 0) return groupCompare
      return collator.compare(a.id, b.id)
    })

    if (uncategorized.length > 0) {
      groups.push({
        id: 'uncategorized',
        title: 'Uncategorized',
        items: uncategorized
      })
    }

    return groups
  }, [items, sortMode])

  const toggleSelection = (id) => {
    if (actionBusy || categorySaving) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleOpenSetCategory = () => {
    if (!canRunActions) return
    setCategoryInput('')
    setShowCategorySuggestions(false)
    setShowCategoryDialog(true)
  }

  const applyCategory = async () => {
    if (!canRunActions) return

    const selectedList = Array.from(selectedIds)
    const selectedSet = new Set(selectedList)
    const nextCategory = categoryInput.trim() === '' ? null : categoryInput.trim()
    const now = new Date().toISOString()

    setCategorySaving(true)
    const { error: updateError } = await supabase
      .from('items_new')
      .update({ category: nextCategory, updated_at: now })
      .eq('list_id', listId)
      .in('id', selectedList)

    if (updateError) {
      setCategorySaving(false)
      alert(updateError.message || 'Failed to update category.')
      return
    }

    setItems((prev) =>
      prev.map((item) =>
        selectedSet.has(item.id) ? { ...item, category: nextCategory } : item
      )
    )
    setCategorySaving(false)
    setShowCategoryDialog(false)
    setShowCategorySuggestions(false)
    setSelectedIds(new Set())
    setToastMessage(`${selectedList.length} items updated`)
  }

  const deleteSelected = async () => {
    if (!canRunActions) return

    const selectedList = Array.from(selectedIds)
    const selectedSet = new Set(selectedList)
    const confirmed = window.confirm(`Delete ${selectedList.length} items? This can't be undone.`)
    if (!confirmed) return

    setActionBusy(true)
    const { error: deleteError } = await supabase
      .from('items_new')
      .delete()
      .eq('list_id', listId)
      .in('id', selectedList)

    if (deleteError) {
      setActionBusy(false)
      alert(deleteError.message || 'Failed to delete items.')
      return
    }

    setItems((prev) => prev.filter((item) => !selectedSet.has(item.id)))
    setSelectedIds(new Set())
    setActionBusy(false)
    setToastMessage(`${selectedList.length} items deleted`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full h-[100dvh] sm:h-[90vh] sm:max-w-5xl bg-white sm:rounded-2xl shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800"
                onClick={onClose}
                aria-label="Close manage items"
              >
                ✕
              </button>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Manage {listName || 'Shopping List'}
              </h2>
            </div>
            {selectedCount > 0 && (
              <div className="hidden lg:flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-700">{selectedCount} selected</span>
                <button
                  type="button"
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-60"
                  onClick={handleOpenSetCategory}
                  disabled={!canRunActions}
                >
                  Set category
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  onClick={deleteSelected}
                  disabled={!canRunActions}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100"
                  onClick={selectAll}
                  disabled={items.length === 0}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100"
                  onClick={clearSelection}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="lg:hidden flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-gray-700 mr-1">{selectedCount} selected</span>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-60"
                onClick={handleOpenSetCategory}
                disabled={!canRunActions}
              >
                Set category
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                onClick={deleteSelected}
                disabled={!canRunActions}
              >
                Delete
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100"
                onClick={selectAll}
                disabled={items.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-100"
                onClick={clearSelection}
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 font-medium">Sort:</span>
            <div className="inline-flex rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                className={`px-3 py-1 rounded-md ${sortMode === 'alphabetical' ? 'bg-customGreen text-white' : 'text-gray-700'}`}
                onClick={() => setSortMode('alphabetical')}
              >
                Alphabetical
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-md ${sortMode === 'category' ? 'bg-customGreen text-white' : 'text-gray-700'}`}
                onClick={() => setSortMode('category')}
              >
                Category
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-gray-500">Loading items...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-gray-500">This list has no items yet.</div>
          ) : (
            <div className="space-y-5">
              {groupedItems.map((group) => (
                <section key={group.id} className="space-y-2">
                  {group.title && (
                    <h3 className="text-sm font-semibold text-gray-700">
                      {group.title}
                    </h3>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {group.items.map((item) => {
                      const isSelected = selectedIds.has(item.id)
                      const category = item?.category?.trim() ? item.category.trim() : 'Uncategorized'
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleSelection(item.id)}
                          disabled={actionBusy || categorySaving}
                          className={`relative rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? 'border-customGreen bg-customGreen/10'
                              : 'border-gray-200 bg-white hover:border-customGreen/50'
                          } disabled:opacity-70 disabled:cursor-not-allowed`}
                        >
                          {isSelected && (
                            <div
                              className="absolute top-2 right-2 w-5 h-5 rounded border border-customGreen bg-customGreen text-white flex items-center justify-center text-xs"
                              aria-hidden="true"
                            >
                              ✓
                            </div>
                          )}
                          <div className="pr-7 text-sm font-semibold text-gray-900 break-words">
                            {item.name}
                          </div>
                          <div className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {category}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {showCategoryDialog && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={closeCategoryDialog}>
            <div
              className="w-full sm:w-[480px] bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Set category for {selectedCount} items
              </h3>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <div className="relative">
                  <input
                    type="text"
                    value={categoryInput}
                    onChange={(event) => {
                      setCategoryInput(event.target.value)
                      setShowCategorySuggestions(true)
                    }}
                    onFocus={() => {
                      setShowCategorySuggestions(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowCategorySuggestions(false), 50)
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                    placeholder="Add a category (optional)"
                    autoFocus
                  />
                  {showCategorySuggestions && filteredCategories.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-md">
                      {filteredCategories.map((suggestion) => (
                        <li key={suggestion}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setCategoryInput(suggestion)
                              setShowCategorySuggestions(false)
                            }}
                          >
                            {suggestion}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700"
                  onClick={closeCategoryDialog}
                  disabled={categorySaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-5 py-2 rounded-lg bg-customGreen text-white font-semibold disabled:opacity-60"
                  onClick={applyCategory}
                  disabled={categorySaving}
                >
                  {categorySaving ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toastMessage && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-gray-900 text-white px-4 py-2 text-sm shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  )
}
