import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SECTIONS, SITE } from '@/lib/constants'
import { useExperience, useFilmSync } from '@/context/ExperienceContext'
import { raisedCosine, softerPeak, windowOpacity } from '@/lib/motion'

/** Tighter lobes — previous chapter fades before the next one reads clearly. */
const HALF_WIDTH = 0.58
const DRIFT_PX = 20
const FLOAT_PX = 2.4
const BREATH_OPACITY = 0.025

/**
 * Continuous overlapping envelopes on the film-master timeline.
 * Text is cinematography — never a hard HTML cut over the movie.
 */
export function ChapterOverlay() {
  const { isLoaded, reducedMotion } = useExperience()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelsRef = useRef<HTMLElement[]>([])
  const frameRef = useRef(0)
  const hiddenRef = useRef(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    panelsRef.current = Array.from(
      root.querySelectorAll<HTMLElement>('[data-chapter-panel]'),
    )
    gsap.set(panelsRef.current, { force3D: true })
  }, [isLoaded])

  useFilmSync((state) => {
    const root = rootRef.current
    const panels = panelsRef.current
    if (!root || !isLoaded || panels.length === 0) return

    // Lock text to raw scroll intent — no smoothing lag
    const progress = state.scrollProgress
    const { now } = state

    const rootAlpha = reducedMotion
      ? progress > 0.045 && progress < 0.84
        ? 1
        : 0
      : windowOpacity(progress, 0.028, 0.06, 0.8, 0.86)

    root.style.opacity = String(rootAlpha)
    root.style.visibility = rootAlpha > 0.01 ? 'visible' : 'hidden'

    if (rootAlpha < 0.01) {
      if (!hiddenRef.current) {
        hiddenRef.current = true
        for (const panel of panels) {
          panel.style.opacity = '0'
          panel.style.visibility = 'hidden'
          panel.style.transform = 'translate3d(0,0,0)'
        }
      }
      return
    }
    hiddenRef.current = false

    // Breath/float only when settled — active scrubbing needs the main thread
    const scrolling =
      Math.abs(state.scrollProgress - state.progress) > 0.01
    frameRef.current += 1
    const updateMotion =
      !reducedMotion && !scrolling && frameRef.current % 2 === 0

    const chapterProgress = Math.min(1, progress / 0.86)
    const exact = chapterProgress * SECTIONS.length
    const t = now * 0.001

    // Pre-compute opacities, then suppress non-dominant panels at crossfades
    const opacities: number[] = []
    for (let i = 0; i < panels.length; i++) {
      if (reducedMotion) {
        const index = Math.min(
          SECTIONS.length - 1,
          Math.max(0, Math.floor(exact)),
        )
        opacities.push(i === index ? 1 : 0)
      } else {
        const center = i + 0.5
        const lobe = raisedCosine(exact - center, HALF_WIDTH)
        const breath =
          updateMotion
            ? 1 + BREATH_OPACITY * Math.sin(t * 1.15 + i * 1.7)
            : 1
        opacities.push(softerPeak(lobe * breath, 0.97))
      }
    }

    let peak = 0
    for (const o of opacities) peak = Math.max(peak, o)

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]
      let opacity = opacities[i]

      // When a new chapter leads, hide the outgoing one promptly
      if (!reducedMotion && peak > 0.12 && opacity < peak * 0.4) {
        opacity = 0
      }

      if (opacity < 0.012) {
        if (panel.style.visibility !== 'hidden') {
          panel.style.opacity = '0'
          panel.style.visibility = 'hidden'
          panel.style.transform = 'translate3d(0,0,0)'
        }
        continue
      }

      panel.style.opacity = String(opacity)
      panel.style.visibility = 'visible'

      if (!reducedMotion && updateMotion) {
        const settle = 1 - opacity
        const float = Math.sin(t * 0.9 + i * 2.1) * FLOAT_PX * opacity
        const drift = settle * DRIFT_PX
        panel.style.transform = `translate3d(0,${drift + float}px,0)`
      }
    }
  }, isLoaded)

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-20"
      style={{ opacity: 0, visibility: 'hidden' }}
      aria-hidden
    >
      {SECTIONS.map((section) => (
        <div
          key={section.id}
          data-chapter-panel
          className="chapter-panel absolute inset-0"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <div className="absolute top-1/2 right-5 hidden -translate-y-1/2 md:right-8 lg:block">
            <span className="font-sans text-[10px] tracking-[0.4em] text-white/70 uppercase [writing-mode:vertical-rl]">
              {section.verticalLabel}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-10 md:px-8 md:pb-12 lg:px-10 lg:pb-14">
            <div className="max-w-xl">
              <p className="mb-3 font-sans text-[10px] tracking-[0.35em] text-white/65 uppercase md:text-[11px]">
                {section.eyebrow}
              </p>
              <h2 className="font-serif text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.95] font-light tracking-[-0.02em] text-white">
                {section.title}
              </h2>
              <p className="mt-5 max-w-md font-serif text-[15px] leading-relaxed font-light text-white/75 md:text-base">
                {section.description}
              </p>
            </div>

            <div className="mt-14 flex items-end justify-between gap-6 md:mt-16">
              <p className="font-sans text-[11px] tracking-[0.28em] text-white/80 tabular-nums">
                {section.index} <span className="text-white/35">/</span>{' '}
                {section.total}
              </p>
              <p className="font-sans text-[9px] tracking-[0.32em] text-white/50 uppercase md:text-[10px]">
                {SITE.credit}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
