import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SITE } from '@/lib/constants'
import { useExperience, useFilmSync } from '@/context/ExperienceContext'
import { windowOpacity } from '@/lib/motion'

function dismissLcpShell() {
  const shell = document.getElementById('lcp-shell')
  if (!shell) return
  shell.setAttribute('data-done', 'true')
  // Keep in DOM briefly so LCP attribution stays stable, then remove.
  window.setTimeout(() => shell.remove(), 80)
}

export function IntroOverlay() {
  const { isLoaded, reducedMotion } = useExperience()
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root || !isLoaded) return

    const items = root.querySelectorAll('[data-intro]')

    if (reducedMotion) {
      gsap.set(items, { autoAlpha: 1, y: 0 })
      dismissLcpShell()
      return
    }

    // HTML `#lcp-shell` already showed this copy for LCP. Take over at full
    // opacity (tiny settle on Y only) so we don't re-hide the brand.
    const shell = document.getElementById('lcp-shell')
    if (shell && shell.getAttribute('data-done') !== 'true') {
      gsap.set(items, { autoAlpha: 1, y: 0 })
      dismissLcpShell()
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
      tl.fromTo(
        items,
        { y: 10 },
        { y: 0, duration: 0.85, stagger: 0.08, clearProps: 'transform' },
      )
      return () => {
        tl.kill()
      }
    }

    const tl = gsap.timeline({
      delay: 0.1,
      defaults: { ease: 'power4.out' },
    })
    tl.fromTo(
      items,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12 },
    )

    return () => {
      tl.kill()
    }
  }, [isLoaded, reducedMotion])

  useFilmSync((state) => {
    const root = rootRef.current
    const content = contentRef.current
    if (!root) return

    const { scrollProgress, now } = state

    const opacity = reducedMotion
      ? scrollProgress > 0.08
        ? 0
        : 1
      : windowOpacity(scrollProgress, -0.02, 0, 0.03, 0.11)

    root.style.opacity = String(opacity)
    root.style.visibility = opacity > 0.02 ? 'visible' : 'hidden'
    root.setAttribute('aria-hidden', opacity < 0.05 ? 'true' : 'false')

    // Micro float while intro is alive — skip while scroll is catching up
    const scrolling =
      Math.abs(state.scrollProgress - state.progress) > 0.008
    frameRef.current += 1
    if (
      content &&
      !reducedMotion &&
      opacity > 0.02 &&
      !scrolling &&
      frameRef.current % 2 === 0
    ) {
      const float = Math.sin(now * 0.0009) * 3.5
      content.style.transform = `translate3d(0,${float}px,0)`
    }
  })

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center"
      aria-hidden={false}
    >
      <div
        ref={contentRef}
        className="absolute inset-x-0 top-[28%] flex flex-col items-center px-6 text-center"
      >
        <p
          data-intro
          className="mb-4 font-sans text-[10px] tracking-[0.5em] text-white/70 uppercase opacity-0"
        >
          Presents
        </p>
        <h1
          data-intro
          className="font-serif text-[clamp(2.5rem,8vw,5rem)] font-light tracking-[-0.02em] text-white opacity-0"
        >
          {SITE.brand}
        </h1>
        <p
          data-intro
          className="mt-5 max-w-sm font-serif text-sm leading-relaxed text-white/65 opacity-0 md:text-base"
        >
          A cinematic walkthrough of a 10,000 sq ft contemporary residence in
          Waccabuc, New York.
        </p>
      </div>
    </div>
  )
}
