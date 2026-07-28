import { useEffect } from 'react'
import gsap from 'gsap'
import { useExperience } from '@/context/ExperienceContext'
import { perf } from '@/lib/performance'

declare global {
  interface Window {
    __heroRevealed?: boolean
  }
}

/**
 * Drives the HTML `#boot-loader` (painted before React) through its finish
 * sequence so LCP can fire on the static hero without a second ink overlay.
 */
export function Loader() {
  const { isLoaded, setLoaded, reducedMotion } = useExperience()

  useEffect(() => {
    if (isLoaded) return

    perf.mark('loader')

    const boot = document.getElementById('boot-loader')
    if (!boot) {
      setLoaded(true)
      return
    }

    let cancelled = false
    let started = false
    let tl: gsap.core.Timeline | null = null
    const timers: number[] = []

    const finish = () => {
      if (cancelled) return
      perf.mark('loader:finish')
      boot.setAttribute('data-done', 'true')
      boot.setAttribute('aria-busy', 'false')
      setLoaded(true)
      timers.push(
        window.setTimeout(() => {
          boot.remove()
        }, 520),
      )
    }

    const runFinish = () => {
      if (cancelled || started) return
      started = true
      boot.setAttribute('data-in', 'true')
      boot.setAttribute('data-reveal', 'true')

      if (reducedMotion) {
        timers.push(window.setTimeout(finish, 100))
        return
      }

      const bar = boot.querySelector<HTMLElement>('.boot-bar')
      if (bar) {
        bar.style.transition = 'none'
        gsap.set(bar, { scaleX: 0.72, transformOrigin: 'left center' })
      }

      tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: finish,
      })

      if (bar) {
        tl.to(bar, { scaleX: 1, duration: 0.55 }, 0)
      } else {
        tl.to({}, { duration: 0.55 }, 0)
      }

      tl.add(() => boot.setAttribute('data-out', 'true'), '+=0.05').to(
        boot,
        {
          autoAlpha: 0,
          duration: 0.55,
          ease: 'power2.inOut',
          pointerEvents: 'none',
        },
        '+=0.08',
      )
    }

    boot.setAttribute('data-in', 'true')

    let fallbackId = 0
    const onReveal = () => {
      window.removeEventListener('hero-revealed', onReveal)
      if (fallbackId) window.clearTimeout(fallbackId)
      runFinish()
    }

    if (window.__heroRevealed || boot.getAttribute('data-reveal') === 'true') {
      runFinish()
    } else {
      window.addEventListener('hero-revealed', onReveal)
      fallbackId = window.setTimeout(() => {
        window.removeEventListener('hero-revealed', onReveal)
        boot.setAttribute('data-reveal', 'true')
        runFinish()
      }, 950)
      timers.push(fallbackId)
    }

    return () => {
      cancelled = true
      tl?.kill()
      for (const id of timers) window.clearTimeout(id)
      window.removeEventListener('hero-revealed', onReveal)
    }
  }, [isLoaded, reducedMotion, setLoaded])

  // HTML owns the visible loader chrome; React only orchestrates it.
  return null
}
