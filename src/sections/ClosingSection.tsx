import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SITE } from '@/lib/constants'
import { useExperience } from '@/context/ExperienceContext'

export function ClosingSection() {
  const rootRef = useRef<HTMLElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const { reducedMotion } = useExperience()

  useEffect(() => {
    const root = rootRef.current
    const logo = logoRef.current
    if (!root || !logo || reducedMotion) return

    const ctx = gsap.context(() => {
      // Opacity + scale only (no filter blur) — same resting look, cheaper paint.
      gsap.fromTo(
        logo,
        { autoAlpha: 0, scale: 0.92 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 1.4,
          ease: 'power4.out',
          force3D: true,
          scrollTrigger: {
            trigger: root,
            start: 'top 60%',
            end: 'top 25%',
            toggleActions: 'play none none reverse',
          },
        },
      )
    }, root)

    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => {
      cancelAnimationFrame(id)
      ctx.revert()
    }
  }, [reducedMotion])

  return (
    <section
      ref={rootRef}
      id="enquire"
      className="relative z-30 flex min-h-[100svh] items-center justify-center bg-ink"
      aria-label="Studio credit and enquiry"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_55%)]" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div ref={logoRef} className="opacity-0">
          <p className="font-sans text-[clamp(2rem,6vw,3.75rem)] font-extralight tracking-[0.18em] text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.35)]">
            {SITE.logoMark}
          </p>
        </div>

        <div className="mt-16 flex w-full max-w-lg flex-col items-center gap-8 md:mt-20">
          <div className="text-center">
            <p className="font-sans text-[10px] tracking-[0.4em] text-white/50 uppercase">
              Studio
            </p>
            <p className="mt-2 font-serif text-2xl font-light text-white md:text-3xl">
              Home Nº 134
            </p>
          </div>

          <a
            href="mailto:hello@nplusj3d.com"
            className="bg-white px-8 py-3.5 font-sans text-[11px] font-medium tracking-[0.32em] text-[#050505] uppercase transition-transform duration-300 hover:scale-[1.03]"
          >
            {SITE.cta}
          </a>

          <p className="font-sans text-[10px] tracking-[0.28em] text-white/40 uppercase">
            {SITE.credit}
          </p>
        </div>
      </div>
    </section>
  )
}
