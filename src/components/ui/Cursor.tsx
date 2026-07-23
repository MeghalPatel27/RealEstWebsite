import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { usePointerPosition } from '@/hooks/usePointer'

export function Cursor() {
  const { visible, isHovering } = usePointerPosition()
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(!window.matchMedia('(pointer: coarse)').matches)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const ring = ringRef.current
    const dot = dotRef.current
    if (!ring || !dot) return

    gsap.set([ring, dot], {
      xPercent: -50,
      yPercent: -50,
      force3D: true,
    })

    const xTo = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power4.out' })
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power4.out' })
    const dxTo = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power3.out' })
    const dyTo = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power3.out' })

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX)
      yTo(e.clientY)
      dxTo(e.clientX)
      dyTo(e.clientY)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const ring = ringRef.current
    if (!ring) return
    gsap.to(ring, {
      scale: isHovering ? 1.85 : 1,
      borderColor: isHovering
        ? 'rgba(255,255,255,0.85)'
        : 'rgba(255,255,255,0.45)',
      duration: 0.35,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }, [isHovering, enabled])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.style.opacity = visible ? '1' : '0'
  }, [visible])

  if (!enabled) return null

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-[90] mix-blend-difference"
      aria-hidden
      style={{ opacity: 0, willChange: 'opacity' }}
    >
      <div
        ref={ringRef}
        className="absolute top-0 left-0 size-9 rounded-full border border-white/45"
      />
      <div
        ref={dotRef}
        className="absolute top-0 left-0 size-1 rounded-full bg-white"
      />
    </div>
  )
}
