import { useEffect, useMemo, useRef, useState } from "react"

export default function EditItemDialog({
  open,
  item,
  categories,
  onSave,
  onDelete,
  onClose
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (!open || !item) return

    setName(item.name || "")
    setCategory(item.category ?? "")
    setSaving(false)
    setError(null)
    setConfirmingDelete(false)
    setShowSuggestions(false)

    // Defer focus until after paint so the field is ready
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
  }, [open, item])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const filteredSuggestions = useMemo(() => {
    const query = category.trim()
    if (!query || query.length < 1) return categories

    const lowerQuery = query.toLowerCase()
    return categories.filter((c) => c.toLowerCase().includes(lowerQuery))
  }, [category, categories])

  if (!open || !item) return null

  const handleSave = async (e) => {
    e?.preventDefault()
    if (saving) return

    const trimmedName = name.trim()
    const trimmedCategory = category.trim()
    const normalizedCategory = trimmedCategory === "" ? null : trimmedCategory

    if (!trimmedName) {
      setError("Name is required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        id: item.id,
        name: trimmedName,
        category: normalizedCategory
      })
      onClose()
    } catch (err) {
      setError(err?.message || "Failed to save item. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setError(null)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onDelete(item.id)
      onClose()
    } catch (err) {
      setError(err?.message || "Failed to delete item. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[480px] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Edit Item</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Item name</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
              placeholder="Enter item name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <div className="relative">
              <input
                type="text"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setConfirmingDelete(false)
                  setShowSuggestions(true)
                }}
                onFocus={() => {
                  setShowSuggestions(true)
                }}
                onBlur={() => {
                  // Delay so clicks on suggestions still register before hiding
                  setTimeout(() => setShowSuggestions(false), 50)
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                placeholder="Add a category (optional)"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-md">
                  {filteredSuggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setCategory(suggestion)
                          setShowSuggestions(false)
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

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className={`px-4 py-2 rounded-lg border ${
                confirmingDelete
                  ? "border-red-600 text-red-700 bg-red-50"
                  : "border-red-200 text-red-600"
              } disabled:opacity-60`}
            >
              {confirmingDelete ? "Confirm delete" : "Delete"}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-5 py-2 rounded-lg bg-customGreen text-white font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
