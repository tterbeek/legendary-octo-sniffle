import { useEffect, useState } from "react"

export default function ShareDialog({
  open,
  defaultName = "",
  loading = false,
  onClose,
  onShare
}) {
  const [name, setName] = useState(defaultName || "")
  const [email, setEmail] = useState("")
  const [error, setError] = useState(null)
  const [successVisible, setSuccessVisible] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(defaultName || "")
    setEmail("")
    setError(null)
    setSuccessVisible(false)
  }, [open, defaultName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    const trimmedEmail = email.trim()
    const trimmedName = name.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!trimmedEmail) {
      setError("Please enter an email.")
      return
    }
    if (!emailRegex.test(trimmedEmail)) {
      setError("Enter a valid email.")
      return
    }

    try {
      await onShare({ email: trimmedEmail, name: trimmedName })
      setError(null)
      setSuccessVisible(true)
      setTimeout(() => setSuccessVisible(false), 2000)
    } catch (err) {
      setError(err?.message || "Failed to share list.")
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-80 max-w-[90vw] rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3">Invite someone you shop with</h3>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
              placeholder="e.g. Alex"
            />
            <div className="text-xs text-gray-500">Shown in the invite email</div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Their email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
              placeholder="name@example.com"
            />
            <div className="text-xs text-gray-500">We'll send them an invite to this list</div>
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          {successVisible && (
            <div className="text-sm text-customGreen">They'll see updates instantly</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-customGreen text-white disabled:opacity-60"
            >
              Share
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
