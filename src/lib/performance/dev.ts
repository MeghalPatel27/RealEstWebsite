import gsap from 'gsap'
import { createLogger } from './logger'
import { endMeasure, measureAsync, measureFrame, perfMark, perfMeasure, startMeasure } from './profiler'
import { metricsStore } from './store'
import type {
  FilmHandlerName,
  PerfAPI,
  PerfMark,
  PerfSnapshot,
  ScrollMetrics,
} from './types'

let rafPatchInstalled = false
let activeRafCount = 0
let observersInstalled = false
let environmentTimer = 0
let samplingTimer = 0

const pendingSeeks = new WeakMap<HTMLVideoElement, () => void>()

function detectBrowser(): string {
  const ua = navigator.userAgent
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  return 'Unknown'
}

function detectGpuVendor(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl) return 'unavailable'
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
    if (!ext) return 'masked'
    const vendor = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_VENDOR_WEBGL)
    const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL)
    return `${vendor} · ${renderer}`
  } catch {
    return 'unavailable'
  }
}

function detectNetworkType(): string {
  const conn = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }).connection
  return conn?.effectiveType ?? 'unknown'
}

function detectSaveData(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(conn?.saveData)
}

async function detectBatterySaver(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ charging: boolean; level: number }>
    }
    if (!nav.getBattery) return false
    const battery = await nav.getBattery()
    return !battery.charging && battery.level < 0.2
  } catch {
    return false
  }
}

function estimateLayerCount(): number {
  let count = 0
  const nodes = document.querySelectorAll('video, .video-stage-grade, .chapter-panel, #lcp-shell, .boot-loader, header, [data-chapter-panel]')
  count += nodes.length
  const fixed = document.querySelectorAll('[class*="fixed"]')
  count += Math.min(fixed.length, 20)
  return count
}

function countGsapAnimations(): number {
  try {
    return gsap.globalTimeline.getChildren(true, true, false).length
  } catch {
    return 0
  }
}

function installRafPatch(): void {
  if (rafPatchInstalled) return
  rafPatchInstalled = true

  const nativeRaf = window.requestAnimationFrame.bind(window)
  const nativeCancel = window.cancelAnimationFrame.bind(window)
  const ids = new Map<number, boolean>()

  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = nativeRaf((time) => {
      ids.delete(id)
      activeRafCount = ids.size
      metricsStore.setActiveRafCount(activeRafCount)
      callback(time)
    })
    ids.set(id, true)
    activeRafCount = ids.size
    metricsStore.setActiveRafCount(activeRafCount)
    return id
  }

  window.cancelAnimationFrame = (id: number): void => {
    ids.delete(id)
    activeRafCount = ids.size
    metricsStore.setActiveRafCount(activeRafCount)
    nativeCancel(id)
  }
}

function installObservers(logger: ReturnType<typeof createLogger>): void {
  if (observersInstalled) return
  observersInstalled = true

  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metricsStore.recordLongTask()
          logger.warn('long-task', `Long task ${entry.duration.toFixed(1)}ms`, {
            duration: entry.duration,
            startTime: entry.startTime,
          })
          perfMark('long-task')
        }
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit)
    } catch {
      /* unsupported */
    }

    try {
      const measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.name.startsWith('perf:')) continue
          if (entry.name.includes('video-seek')) {
            logger.debug('seek', `${entry.name} ${entry.duration.toFixed(2)}ms`)
          }
        }
      })
      measureObserver.observe({ type: 'measure', buffered: true })
    } catch {
      /* unsupported */
    }
  }
}

function refreshEnvironment(): void {
  metricsStore.setEnvironment({
    devicePixelRatio: window.devicePixelRatio,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    browser: detectBrowser(),
    gpuVendor: detectGpuVendor(),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    touchDevice: window.matchMedia('(pointer: coarse)').matches,
    saveData: detectSaveData(),
    networkType: detectNetworkType(),
  })

  void detectBatterySaver().then((batterySaver) => {
    metricsStore.setEnvironment({ batterySaver })
  })
}

function refreshSampling(): void {
  metricsStore.setLayerCountEstimate(estimateLayerCount())
  metricsStore.setActiveAnimationCount(countGsapAnimations())
  metricsStore.setListenerEstimate(
    (window as Window & { getEventListeners?: (n: Node) => unknown }).getEventListeners
      ? -1
      : document.querySelectorAll('*').length,
  )
}

function wrapFilmHandler<T extends (...args: never[]) => void>(
  name: FilmHandlerName,
  handler: T,
): T {
  const wrapped = ((...args: never[]) => {
    perfMark('overlay-sync:start')
    const start = performance.now()
    handler(...args)
    const duration = performance.now() - start
    metricsStore.recordOverlaySync(name, duration)
    if (name === 'navbar') metricsStore.recordNavbarSync(duration)
    perfMark('overlay-sync:end')
    perfMeasure('overlay-sync', 'overlay-sync:start', 'overlay-sync:end')
  }) as T
  return wrapped
}

function measureVideoSeek(
  video: HTMLVideoElement,
  targetTime: number,
  apply: () => void,
): void {
  const previous = pendingSeeks.get(video)
  if (previous) {
    video.removeEventListener('seeked', previous)
    pendingSeeks.delete(video)
  }

  metricsStore.beginVideoSeek()
  perfMark('video:seek-start')

  const onSeeked = () => {
    video.removeEventListener('seeked', onSeeked)
    pendingSeeks.delete(video)
    metricsStore.endVideoSeek()
    perfMark('video:seek-end')
    perfMeasure('video-seek', 'video:seek-start', 'video:seek-end')
    logger.debug('seek', `seeked → ${targetTime.toFixed(3)}s`)
  }

  pendingSeeks.set(video, onSeeked)
  video.addEventListener('seeked', onSeeked, { once: true })

  const decodeStart = performance.now()
  apply()

  requestAnimationFrame(() => {
    const decodeDelay = performance.now() - decodeStart
    if (decodeDelay > 8) {
      logger.debug('decode', `decode delay ${decodeDelay.toFixed(1)}ms`, { targetTime })
      perfMark('video:decode')
    }
  })
}

const logger = createLogger()

let gsapTickMs = 0
let initialized = false

export const perf: PerfAPI = {
  enabled: true,
  init() {
    if (initialized) return
    initialized = true
    metricsStore.initHeap()
    refreshEnvironment()
    refreshSampling()
    installRafPatch()
    installObservers(logger)
    window.__PERF__ = perf

    environmentTimer = window.setInterval(refreshEnvironment, 5000)
    samplingTimer = window.setInterval(refreshSampling, 2000)

    perfMark('perf:init')
    logger.info('init', 'Performance instrumentation enabled (dev only)')
  },

  destroy() {
    if (!initialized) return
    initialized = false
    window.clearInterval(environmentTimer)
    window.clearInterval(samplingTimer)
    delete window.__PERF__
    perfMark('perf:destroy')
  },

  getSnapshot(): PerfSnapshot {
    return metricsStore.snapshot
  },

  subscribe(listener: (snapshot: PerfSnapshot) => void) {
    return metricsStore.subscribe(listener)
  },

  mark(name: PerfMark | string) {
    perfMark(name)
  },

  measure(name, startMark, endMark) {
    perfMeasure(name, startMark, endMark)
  },

  startMeasure,
  endMeasure,
  measureAsync,
  measureFrame,

  measureLongTask(duration: number) {
    metricsStore.recordLongTask()
    logger.warn('long-task', `Synthetic long task ${duration.toFixed(1)}ms`)
  },

  measureVideoSeek,
  measureRender(component, duration) {
    metricsStore.incrementReactRender()
    logger.debug('react-render', `${component} ${duration.toFixed(2)}ms`)
    perfMark(`react-render:${component}`)
  },

  wrapFilmHandler,

  frameStart() {
    metricsStore.beginFrame()
    perfMark('frame:start')
  },

  frameEnd() {
    metricsStore.endFrame(gsapTickMs)
    perfMark('frame:end')
    perfMeasure('raf', 'frame:start', 'frame:end')
    gsapTickMs = 0
  },

  recordLenis(durationMs: number) {
    metricsStore.recordLenis(durationMs)
  },

  recordGsapTick(durationMs: number) {
    gsapTickMs = durationMs
    metricsStore.recordGsapTick(durationMs)
  },

  recordFilmSync(durationMs: number) {
    metricsStore.recordFilmSync(durationMs)
  },

  recordOverlaySync(name, durationMs) {
    metricsStore.recordOverlaySync(name, durationMs)
  },

  recordNavbarSync(durationMs) {
    metricsStore.recordNavbarSync(durationMs)
  },

  recordVideoTarget(targetTime) {
    metricsStore.recordVideoTarget(targetTime)
  },

  recordVideoDrive(durationMs) {
    metricsStore.recordVideoDrive(durationMs)
  },

  setVideoElement(video) {
    metricsStore.setVideoElement(video)
  },

  setVideoSyncMode(mode) {
    metricsStore.setVideoSyncMode(mode)
  },

  updateScroll(data: Partial<ScrollMetrics> & { lenis?: { velocity: number; direction: number } }) {
    metricsStore.updateScroll({
      scrollProgress: data.scrollProgress,
      filmProgress: data.filmProgress,
      activeSection: data.activeSection,
      lenisVelocity: data.lenis?.velocity ?? data.lenisVelocity,
      lenisDirection: data.lenis?.direction ?? data.lenisDirection,
    })
  },

  incrementReactRender(component, phase, duration) {
    metricsStore.incrementReactRender()
    if (phase === 'mount' || phase === 'update') {
      logger.debug('react-render', `${component}:${phase} ${duration.toFixed(2)}ms`)
    }
  },

  logger,
}
