import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useExperience } from '@/context/ExperienceContext'
import { SITE } from '@/lib/constants'

export function Loader() {
  const { isLoaded, setLoaded, reducedMotion } = useExperience()
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (isLoaded) return

    const root = rootRef.current
    const bar = barRef.current
    const mark = markRef.current
    if (!root || !bar || !mark) return

    const tl = gsap.timeline({
      defaults: { ease: 'power4.out' },
      onComplete: () => setLoaded(true),
    })

    if (reducedMotion) {
      tl.to(bar, { scaleX: 1, duration: 0.2 }).to(root, {
        autoAlpha: 0,
        duration: 0.3,
        pointerEvents: 'none',
      })
      return () => {
        tl.kill()
      }
    }

    tl.fromTo(
      mark,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.9 },
    )
      .fromTo(
        bar,
        { scaleX: 0 },
        { scaleX: 1, duration: 1.6, ease: 'power2.inOut' },
        '-=0.3',
      )
      .to(mark, { autoAlpha: 0, y: -10, duration: 0.45 }, '+=0.15')
      .to(
        root,
        {
          autoAlpha: 0,
          duration: 0.75,
          ease: 'power2.inOut',
          pointerEvents: 'none',
        },
        '-=0.2',
      )

    return () => {
      tl.kill()
    }
  }, [isLoaded, reducedMotion, setLoaded])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink"
      aria-hidden={isLoaded}
      aria-busy={!isLoaded}
      role="status"
    >
      <p
        ref={markRef}
        className="mb-10 font-sans text-[11px] font-light tracking-[0.45em] text-white/90 uppercase opacity-0"
      >
        {SITE.logoMark}
      </p>
      <div className="h-px w-40 overflow-hidden bg-white/15">
        <div
          ref={barRef}
          className="h-full w-full origin-left scale-x-0 bg-white"
        />
      </div>
      <span className="sr-only">Loading experience</span>
    </div>
  )
}
