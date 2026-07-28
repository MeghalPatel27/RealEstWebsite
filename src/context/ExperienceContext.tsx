import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  SECTIONS,
  videoTimeFromProgress,
  type SectionId,
} from '@/lib/constants'
import { easeOutQuint } from '@/lib/motion'
import { perf } from '@/lib/performance'
import {
  driveVideoToward,
  getVideoSyncMode,
  resolveFilmProgress,
  type FilmHandler,
  type FilmState,
} from '@/lib/filmClock'

gsap.registerPlugin(ScrollTrigger)

type ScrollHandler = (progress: number) => void

interface ExperienceContextValue {
  lenis: Lenis | null
  activeSection: SectionId
  isLoaded: boolean
  setLoaded: (value: boolean) => void
  isMuted: boolean
  setMuted: (value: boolean) => void
  scrollToSection: (id: SectionId) => void
  reducedMotion: boolean
  /** Lenis scroll bus (intent). Prefer subscribeFilm for cinematic UI. */
  subscribeScroll: (handler: ScrollHandler) => () => void
  /** Master timeline — progress derived from the film playhead. */
  subscribeFilm: (handler: FilmHandler) => () => void
  /** Register the hero <video> with the film clock. */
  registerFilmVideo: (video: HTMLVideoElement | null) => void
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null)

function sectionFromProgress(progress: number): SectionId {
  const chapterProgress = Math.min(1, progress / 0.86)
  const index = Math.min(
    SECTIONS.length - 1,
    Math.max(0, Math.floor(chapterProgress * SECTIONS.length)),
  )
  return SECTIONS[index].id
}

const MAX_WHEEL_DELTA = 120

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>('arrival')
  const [isLoaded, setLoaded] = useState(false)
  const [isMuted, setMuted] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  const activeSectionRef = useRef<SectionId>('arrival')
  const isLoadedRef = useRef(false)
  const scrollHandlersRef = useRef(new Set<ScrollHandler>())
  const filmHandlersRef = useRef(new Set<FilmHandler>())
  const scrollProgressRef = useRef(0)
  const filmProgressRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const durationRef = useRef(15)
  const reducedMotionRef = useRef(false)
  const tickFrameRef = useRef(0)

  const subscribeScroll = useCallback((handler: ScrollHandler) => {
    scrollHandlersRef.current.add(handler)
    return () => {
      scrollHandlersRef.current.delete(handler)
    }
  }, [])

  const subscribeFilm = useCallback((handler: FilmHandler) => {
    filmHandlersRef.current.add(handler)
    return () => {
      filmHandlersRef.current.delete(handler)
    }
  }, [])

  const registerFilmVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video
    if (video && video.duration && Number.isFinite(video.duration)) {
      durationRef.current = video.duration
    }
  }, [])

  useEffect(() => {
    isLoadedRef.current = isLoaded
  }, [isLoaded])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(media.matches)
      reducedMotionRef.current = media.matches
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    if (isTouch) document.body.classList.add('is-touch')

    const instance = new Lenis({
      // Firm enough to feel attached; still slightly soft for cinematic inertia
      lerp: reducedMotion ? 1 : 0.22,
      smoothWheel: !reducedMotion,
      wheelMultiplier: 1.05,
      touchMultiplier: 1.2,
      syncTouch: true,
      syncTouchLerp: reducedMotion ? 1 : 0.18,
      touchInertiaExponent: 1.25,
      autoRaf: false,
      virtualScroll: (data) => {
        data.deltaY = Math.max(
          -MAX_WHEEL_DELTA,
          Math.min(MAX_WHEEL_DELTA, data.deltaY),
        )
        data.deltaX = 0
        return true
      },
    })

    setLenis(instance)
    perf.mark('lenis')
    ;(window as Window & { __lenis?: Lenis }).__lenis = instance

    instance.on('scroll', (e) => {
      scrollProgressRef.current = e.progress
      for (const handler of scrollHandlersRef.current) {
        handler(e.progress)
      }
    })

    const onTick = (time: number) => {
      perf.mark('gsap-tick-start')
      perf.frameStart()
      const tickStart = performance.now()

      const lenisStart = performance.now()
      instance.raf(time * 1000)
      perf.recordLenis(performance.now() - lenisStart)

      const reduced = reducedMotionRef.current
      const scrollP = scrollProgressRef.current
      // Adaptive catch-up: stay glued to the wheel
      const gap = Math.abs(scrollP - filmProgressRef.current)
      const catchUp = reduced ? 1 : gap > 0.01 ? 0.7 : 0.45
      filmProgressRef.current += (scrollP - filmProgressRef.current) * catchUp

      // ScrollTrigger only needed near the closing section
      if (scrollP > 0.78) {
        perf.mark('closing-section')
        ScrollTrigger.update()
      }

      const video = videoRef.current
      if (video?.duration) durationRef.current = video.duration
      const duration = durationRef.current

      tickFrameRef.current += 1

      const targetTime = videoTimeFromProgress(filmProgressRef.current, duration)
      perf.recordVideoTarget(targetTime)

      if (video && isLoadedRef.current) {
        const driveStart = performance.now()
        driveVideoToward({
          video,
          targetTime,
          pageProgress: filmProgressRef.current,
          reducedMotion: reduced,
          frameId: tickFrameRef.current,
        })
        perf.recordVideoDrive(performance.now() - driveStart)
        perf.setVideoSyncMode(getVideoSyncMode())
      }

      const resolved = resolveFilmProgress(
        video,
        filmProgressRef.current,
        duration,
      )

      const state: FilmState = {
        progress: filmProgressRef.current,
        scrollProgress: scrollP,
        videoTime: resolved.videoTime,
        now: performance.now(),
      }

      const filmStart = performance.now()
      perf.mark('film-sync-start')
      for (const handler of filmHandlersRef.current) {
        handler(state)
      }
      perf.recordFilmSync(performance.now() - filmStart)
      perf.mark('film-sync-end')
      perf.measure('film-sync', 'film-sync-start', 'film-sync-end')

      const next = sectionFromProgress(scrollP)
      if (next !== activeSectionRef.current) {
        activeSectionRef.current = next
        setActiveSection(next)
      }

      perf.updateScroll({
        scrollProgress: scrollP,
        filmProgress: filmProgressRef.current,
        activeSection: activeSectionRef.current,
        lenis: {
          velocity: instance.velocity,
          direction: instance.direction,
        },
      })

      perf.recordGsapTick(performance.now() - tickStart)
      perf.mark('gsap-tick-end')
      perf.measure('gsap-tick', 'gsap-tick-start', 'gsap-tick-end')
      perf.frameEnd()
    }

    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh())

    return () => {
      cancelAnimationFrame(refreshId)
      gsap.ticker.remove(onTick)
      instance.destroy()
      setLenis(null)
    }
  }, [reducedMotion])

  useEffect(() => {
    if (!isLoaded) return
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [isLoaded])

  const scrollToSection = useCallback(
    (id: SectionId) => {
      const el = document.getElementById(`section-${id}`)
      if (!el) return
      if (lenis) {
        lenis.scrollTo(el, {
          offset: 0,
          duration: reducedMotion ? 0.5 : 2.05,
          easing: easeOutQuint,
        })
      } else {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    },
    [lenis, reducedMotion],
  )

  const value = useMemo(
    () => ({
      lenis,
      activeSection,
      isLoaded,
      setLoaded,
      isMuted,
      setMuted,
      scrollToSection,
      reducedMotion,
      subscribeScroll,
      subscribeFilm,
      registerFilmVideo,
    }),
    [
      lenis,
      activeSection,
      isLoaded,
      isMuted,
      scrollToSection,
      reducedMotion,
      subscribeScroll,
      subscribeFilm,
      registerFilmVideo,
    ],
  )

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  )
}

export function useExperience() {
  const ctx = useContext(ExperienceContext)
  if (!ctx) {
    throw new Error('useExperience must be used within ExperienceProvider')
  }
  return ctx
}

/** Subscribe to Lenis progress without React re-renders. */
export function useScrollSync(handler: ScrollHandler, enabled = true) {
  const { subscribeScroll, lenis } = useExperience()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !lenis) return
    const wrapped: ScrollHandler = (progress) => handlerRef.current(progress)
    wrapped(lenis.progress)
    return subscribeScroll(wrapped)
  }, [subscribeScroll, enabled, lenis])
}

/** Subscribe to the film-master timeline (preferred for overlays). */
export function useFilmSync(handler: FilmHandler, enabled = true) {
  const { subscribeFilm, lenis } = useExperience()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const wrapped: FilmHandler = (state) => handlerRef.current(state)
    if (lenis) {
      wrapped({
        progress: lenis.progress,
        scrollProgress: lenis.progress,
        videoTime: 0,
        now: performance.now(),
      })
    }
    return subscribeFilm(wrapped)
  }, [subscribeFilm, enabled, lenis])
}
