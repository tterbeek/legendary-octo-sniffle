import { useEffect, useRef, useState } from 'react'

export default function FitText({ text, maxFont = 24, minFont = 8, padding = 16 }) {
  const ref = useRef(null)
  const [fontSize, setFontSize] = useState(maxFont)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let size = maxFont
    const parentWidth = el.parentElement.offsetWidth - padding // subtract total horizontal padding
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    context.font = `${size}px sans-serif`

    // shrink font until text width fits
    while (context.measureText(text).width > parentWidth && size > minFont) {
      size -= 1
      context.font = `${size}px sans-serif`
    }

    setFontSize(size)
  }, [text, maxFont, minFont, padding])

  return (
    <span
      ref={ref}
      style={{ fontSize: `${fontSize}px`, lineHeight: '1.1em' }}
      className="w-full text-center break-words"
    >
      {text}
    </span>
  )
}
