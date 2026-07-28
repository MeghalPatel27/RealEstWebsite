import type { SectionId } from '@/lib/constants'

export type PerformanceMode = 'good' | 'degraded' | 'critical' | 'idle'

export type FilmHandlerName =
  | 'navbar'
  | 'intro'
  | 'chapter'
  | 'video-controls'
  | 'unknown'

export type PerfMark =
  | 'video'
  | 'lenis'
  | 'gsap'
  | 'film-sync'
  | 'overlay-sync'
  | 'navbar'
  | 'loader'
  | 'closing-section'
  | 'gsap-tick'
  | 'frame'

export type MeasureName =
  | 'video-seek'
  | 'video-decode'
  | 'raf'
  | 'gsap-tick'
  | 'lenis'
  | 'film-sync'
  | 'overlay-sync'
  | 'navbar-sync'
  | 'react-render'
  | 'long-task'

export interface FpsMetrics {
  current: number
  average: number
  min: number
  max: number
}

export interface FrameMetrics {
  frameTimeMs: number
  droppedFrames: number
  rafDurationMs: number
  gsapTickMs: number
  jsFrameCostMs: number
}

export interface VideoMetrics {
  currentTime: number
  targetTime: number
  playbackRate: number
  readyState: number
  bufferedPercent: number
  decodeHealth: 'unknown' | 'good' | 'degraded' | 'stalled'
  syncMode: string
  seekCount: number
  avgSeekLatencyMs: number
  lastSeekLatencyMs: number
  resolution: string
  source: string
}

export interface ScrollMetrics {
  scrollProgress: number
  filmProgress: number
  activeSection: SectionId
  lenisVelocity: number
  lenisDirection: number
  scrollSpeed: number
}

export interface SystemMetrics {
  memoryMb: number
  jsHeapMb: number
  heapGrowthMb: number
  listenerCountEstimate: number
  activeAnimationCount: number
  activeRafCount: number
  layerCountEstimate: number
  longTaskCount: number
  gcSpikeCount: number
}

export interface EnvironmentMetrics {
  devicePixelRatio: number
  viewport: string
  browser: string
  gpuVendor: string
  reducedMotion: boolean
  touchDevice: boolean
  batterySaver: boolean
  saveData: boolean
  networkType: string
  performanceMode: PerformanceMode
}

export interface PipelineEstimates {
  styleRecalcMs: number
  layoutMs: number
  paintMs: number
  compositeMs: number
}

export interface HandlerTiming {
  totalMs: number
  lastMs: number
}

export interface PerfSnapshot {
  fps: FpsMetrics
  frame: FrameMetrics
  video: VideoMetrics
  scroll: ScrollMetrics
  system: SystemMetrics
  environment: EnvironmentMetrics
  pipeline: PipelineEstimates
  reactRenderCount: number
  handlerTimings: Partial<Record<FilmHandlerName, HandlerTiming>>
  uptimeMs: number
}

export interface PerfLogger {
  debug: (channel: string, message: string, data?: Record<string, unknown>) => void
  info: (channel: string, message: string, data?: Record<string, unknown>) => void
  warn: (channel: string, message: string, data?: Record<string, unknown>) => void
}

export interface PerfAPI {
  readonly enabled: boolean
  init: () => void
  destroy: () => void
  getSnapshot: () => PerfSnapshot
  subscribe: (listener: (snapshot: PerfSnapshot) => void) => () => void
  mark: (name: PerfMark | string) => void
  measure: (name: MeasureName | string, startMark: string, endMark: string) => void
  startMeasure: (name: string) => void
  endMeasure: (name: string) => number
  measureAsync: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  measureFrame: (fn: () => void) => void
  measureLongTask: (duration: number) => void
  measureVideoSeek: (video: HTMLVideoElement, targetTime: number, apply: () => void) => void
  measureRender: (component: string, duration: number) => void
  wrapFilmHandler: <T extends (...args: never[]) => void>(
    name: FilmHandlerName,
    handler: T,
  ) => T
  frameStart: () => void
  frameEnd: () => void
  recordLenis: (durationMs: number) => void
  recordGsapTick: (durationMs: number) => void
  recordFilmSync: (durationMs: number) => void
  recordOverlaySync: (name: FilmHandlerName, durationMs: number) => void
  recordNavbarSync: (durationMs: number) => void
  recordVideoTarget: (targetTime: number) => void
  recordVideoDrive: (durationMs: number) => void
  setVideoElement: (video: HTMLVideoElement | null) => void
  setVideoSyncMode: (mode: string) => void
  updateScroll: (data: Partial<ScrollMetrics> & { lenis?: { velocity: number; direction: number } }) => void
  incrementReactRender: (component: string, phase: string, duration: number) => void
  logger: PerfLogger
}

declare global {
  interface Window {
    __PERF__?: PerfAPI
  }
}
