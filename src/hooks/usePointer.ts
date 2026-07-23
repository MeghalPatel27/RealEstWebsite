import { useEffect, useState } from 'react'

/**
 * Pointer hover/visibility only — position is handled by GSAP quickTo in Cursor.
 * Avoids React re-renders on every mousemove.
 */
export function usePointerPosition() {
  const [visible, setVisible] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    let hovering = false
    let shown = false

    const onMove = (e: MouseEvent) => {
      if (!shown) {
        shown = true
        setVisible(true)
      }
      const target = e.target as HTMLElement | null
      const interactive = Boolean(
        target?.closest('a, button, [data-cursor="interactive"]'),
      )
      if (interactive !== hovering) {
        hovering = interactive
        setIsHovering(interactive)
      }
    }

    const onLeave = () => {
      shown = false
      setVisible(false)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return { visible, isHovering }
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}
