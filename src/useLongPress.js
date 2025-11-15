import { useRef } from "react"

export default function useLongPress(LONG = 800, MOVE = 10) {
  const pointerTypeRef = useRef("mouse")
  const startPosRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)
  const longPressFiredRef = useRef(false)
  const timerRef = useRef(null)

  const bind = ({
    onLongPress,
    onTap,
    onRightClick
  }) => ({
    onPointerDown: (e) => {
      pointerTypeRef.current = e.pointerType

      // track touch movement
      startPosRef.current = { x: e.clientX, y: e.clientY }
      movedRef.current = false
      longPressFiredRef.current = false

      if (e.pointerType === "touch") {
        timerRef.current = setTimeout(() => {
          if (movedRef.current) return

          longPressFiredRef.current = true
          onLongPress?.()
        }, LONG)
      }
    },

    onPointerMove: (e) => {
      const dx = Math.abs(e.clientX - startPosRef.current.x)
      const dy = Math.abs(e.clientY - startPosRef.current.y)

      if (dx > MOVE || dy > MOVE) {
        movedRef.current = true
        clearTimeout(timerRef.current)
      }
    },

    onPointerUp: () => {
      clearTimeout(timerRef.current)

      if (movedRef.current) return
      if (longPressFiredRef.current) return

      // tap
      if (pointerTypeRef.current === "touch") {
        onTap?.()
      }
    },

    onContextMenu: (e) => {
      e.preventDefault()

      // suppress synthetic contextmenus after long-press
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false
        return
      }

      // desktop only
      if (pointerTypeRef.current === "mouse") {
        onRightClick?.()
      }
    }
  })

  return { bind }
}
