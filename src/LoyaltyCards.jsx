import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export default function LoyaltyCards({ supabase, user }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lightboxCard, setLightboxCard] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newImageBlob, setNewImageBlob] = useState(null)
  const [newImagePreview, setNewImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editCard, setEditCard] = useState(null)
  const [editName, setEditName] = useState('')
  const [editImageBlob, setEditImageBlob] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)
  const [editResetImage, setEditResetImage] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editing, setEditing] = useState(false)
  const uploadInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const editUploadInputRef = useRef(null)
  const editCameraInputRef = useRef(null)

  const loadCards = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('loyalty_cards')
        .select('id, name, image_path, created_at')
        .eq('user_id', user.id)

      if (fetchError) throw fetchError

      const sorted = (data || []).slice().sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      )

      const paths = sorted.map(card => card.image_path).filter(Boolean)
      let urlMap = new Map()

      if (paths.length) {
        const { data: signed, error: signedError } = await supabase
          .storage
          .from('loyaltycards')
          .createSignedUrls(paths, 60 * 60)

        if (signedError) throw signedError

        urlMap = new Map(
          signed
            .map((entry, index) => [paths[index], entry?.signedUrl || null])
            .filter(([, url]) => !!url)
        )
      }

      const withUrls = sorted.map(card => ({
        ...card,
        imageUrl: card.image_path ? urlMap.get(card.image_path) || null : null
      }))

      setCards(withUrls)
    } catch (err) {
      console.error('Failed to load loyalty cards', err)
      setError('Could not load loyalty cards.')
    } finally {
      setLoading(false)
    }
  }, [supabase, user?.id])

  useEffect(() => {
    let mounted = true
    if (!mounted) return
    loadCards()
    return () => {
      mounted = false
    }
  }, [loadCards])

  useEffect(() => {
    return () => {
      if (newImagePreview?.startsWith('blob:')) URL.revokeObjectURL(newImagePreview)
    }
  }, [newImagePreview])

  useEffect(() => {
    return () => {
      if (editImagePreview?.startsWith('blob:')) URL.revokeObjectURL(editImagePreview)
    }
  }, [editImagePreview])

  const resetForm = () => {
    setNewName('')
    setNewImageBlob(null)
    if (newImagePreview?.startsWith('blob:')) URL.revokeObjectURL(newImagePreview)
    setNewImagePreview(null)
    setFormError(null)
  }

  const resetEditForm = () => {
    setEditCard(null)
    setEditName('')
    setEditImageBlob(null)
    if (editImagePreview?.startsWith('blob:')) URL.revokeObjectURL(editImagePreview)
    setEditImagePreview(null)
    setEditResetImage(false)
    setEditError(null)
  }

  const resizeImage = async (file) => {
    const imageUrl = URL.createObjectURL(file)
    const img = new Image()
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    img.src = imageUrl
    await loadPromise

    const maxDim = 1500
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const width = Math.round(img.width * scale)
    const height = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(
        (result) => resolve(result),
        'image/jpeg',
        0.8
      )
    })

    URL.revokeObjectURL(imageUrl)
    return blob
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    setFormError(null)
    try {
      const blob = await resizeImage(file)
      if (!blob) throw new Error('Image processing failed')
      setNewImageBlob(blob)
      if (newImagePreview?.startsWith('blob:')) URL.revokeObjectURL(newImagePreview)
      setNewImagePreview(URL.createObjectURL(blob))
    } catch (err) {
      console.error(err)
      setFormError('Failed to process image.')
    }
  }

  const handleEditFileSelect = async (file) => {
    if (!file) return
    setEditError(null)
    try {
      const blob = await resizeImage(file)
      if (!blob) throw new Error('Image processing failed')
      setEditImageBlob(blob)
      setEditResetImage(true)
      if (editImagePreview?.startsWith('blob:')) URL.revokeObjectURL(editImagePreview)
      setEditImagePreview(URL.createObjectURL(blob))
    } catch (err) {
      console.error(err)
      setEditError('Failed to process image.')
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    if (!newName.trim()) {
      setFormError('Please enter a name.')
      return
    }
    if (!newImageBlob) {
      setFormError('Please upload an image.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const fileId = crypto.randomUUID()
      const path = `${user.id}/${fileId}.jpg`

      const { error: uploadError } = await supabase
        .storage
        .from('loyaltycards')
        .upload(path, newImageBlob, {
          contentType: 'image/jpeg',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { error: insertError } = await supabase
        .from('loyalty_cards')
        .insert({
          user_id: user.id,
          name: newName.trim(),
          image_path: path
        })

      if (insertError) throw insertError

      await loadCards()
      setShowAddModal(false)
      resetForm()
    } catch (err) {
      console.error('Failed to save loyalty card', err)
      setFormError('Could not save loyalty card.')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (card) => {
    setEditCard(card)
    setEditName(card.name)
    setEditImageBlob(null)
    setEditResetImage(false)
    if (editImagePreview?.startsWith('blob:')) URL.revokeObjectURL(editImagePreview)
    setEditImagePreview(card.imageUrl || null)
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEditSave = async () => {
    if (!user?.id || !editCard) return
    if (!editName.trim()) {
      setEditError('Please enter a name.')
      return
    }
    if (editResetImage && !editImageBlob) {
      setEditError('Please upload a new image.')
      return
    }
    setEditing(true)
    setEditError(null)
    try {
      let nextPath = editCard.image_path

      if (editImageBlob) {
        const fileId = crypto.randomUUID()
        const path = `${user.id}/${fileId}.jpg`

        const { error: uploadError } = await supabase
          .storage
          .from('loyaltycards')
          .upload(path, editImageBlob, {
            contentType: 'image/jpeg',
            upsert: false
          })

        if (uploadError) throw uploadError
        nextPath = path

        if (editCard.image_path) {
          supabase.storage.from('loyaltycards').remove([editCard.image_path]).catch(() => {})
        }
      }

      const updatePayload = {
        name: editName.trim(),
        image_path: nextPath
      }

      const { error: updateError } = await supabase
        .from('loyalty_cards')
        .update(updatePayload)
        .eq('id', editCard.id)

      if (updateError) throw updateError

      await loadCards()
      setShowEditModal(false)
      resetEditForm()
    } catch (err) {
      console.error('Failed to update loyalty card', err)
      setEditError('Could not update loyalty card.')
    } finally {
      setEditing(false)
    }
  }

  const hasCards = cards.length > 0
  const sortedCards = useMemo(() => cards, [cards])

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="w-[96px]" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-700 text-center flex-1">
            Loyalty Cards
          </h1>
          <div className="w-[96px] flex justify-end">
            <button
              type="button"
              className="bg-customGreen text-white px-4 py-2 rounded-lg hover:bg-customGreen-hover transition-colors"
              onClick={() => setShowAddModal(true)}
            >
              + Add
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-gray-500">Loading loyalty cards...</div>
        )}

        {!loading && error && (
          <div className="text-red-600">{error}</div>
        )}

        {!loading && !error && !hasCards && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-gray-600 text-center">
            No loyalty cards yet.
          </div>
        )}

        {!loading && !error && hasCards && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedCards.map(card => (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                className="bg-white rounded-2xl shadow hover:shadow-md transition-shadow text-left p-3 cursor-pointer"
                onClick={() => setLightboxCard(card)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setLightboxCard(card)
                  }
                }}
              >
                <div className="aspect-[3/2] rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center p-2">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={`${card.name} loyalty card`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-xs text-gray-500">No image</div>
                  )}
                </div>
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-gray-800 truncate text-left w-full hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEditModal(card)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {card.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxCard && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightboxCard(null)}
        >
          <div
            className="max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl p-3 shadow-lg">
              {lightboxCard.imageUrl ? (
                <img
                  src={lightboxCard.imageUrl}
                  alt={`${lightboxCard.name} loyalty card`}
                  className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
                />
              ) : (
                <div className="text-center text-gray-600 py-10">
                  No image available.
                </div>
              )}
              <div className="mt-3 text-center text-sm text-gray-600">
                Tap outside the image to close.
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Loyalty Card</h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="e.g. Carrefour"
            />

            <div className="flex items-center gap-3 mb-4">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => uploadInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => cameraInputRef.current?.click()}
              >
                Snap
              </button>
              {newImagePreview && (
                <span className="text-xs text-gray-500">Image ready</span>
              )}
            </div>

            {newImagePreview && (
              <div className="mb-4">
                <img
                  src={newImagePreview}
                  alt="Preview"
                  className="w-full max-h-56 object-contain rounded-lg border"
                />
              </div>
            )}

            {formError && (
              <div className="text-sm text-red-600 mb-3">{formError}</div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-customGreen text-white hover:bg-customGreen-hover transition-colors"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editCard && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Edit Loyalty Card</h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="e.g. Carrefour"
            />

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <input
                ref={editUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleEditFileSelect(e.target.files?.[0])}
              />
              <input
                ref={editCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleEditFileSelect(e.target.files?.[0])}
              />
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => editUploadInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => editCameraInputRef.current?.click()}
              >
                Snap
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => {
                  setEditResetImage(true)
                  setEditImageBlob(null)
                  if (editImagePreview?.startsWith('blob:')) URL.revokeObjectURL(editImagePreview)
                  setEditImagePreview(null)
                }}
              >
                Reset image
              </button>
              {editImagePreview && (
                <span className="text-xs text-gray-500">Image ready</span>
              )}
            </div>

            {editImagePreview && (
              <div className="mb-4">
                <img
                  src={editImagePreview}
                  alt="Preview"
                  className="w-full max-h-56 object-contain rounded-lg border"
                />
              </div>
            )}

            {editError && (
              <div className="text-sm text-red-600 mb-3">{editError}</div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                onClick={() => {
                  setShowEditModal(false)
                  resetEditForm()
                }}
                disabled={editing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-customGreen text-white hover:bg-customGreen-hover transition-colors"
                onClick={handleEditSave}
                disabled={editing}
              >
                {editing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
