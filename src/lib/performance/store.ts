import type { SectionId } from '@/lib/constants'
import type {
  EnvironmentMetrics,
  FilmHandlerName,
  HandlerTiming,
  PerformanceMode,
  PerfSnapshot,
} from './types'

const FPS_RING = 120
const SEEK_RING = 64
const TIMING_RING = 60

const EMPTY_HANDLER: HandlerTiming = { totalMs: 0, lastMs: 0 }

export function createInitialSnapshot(): PerfSnapshot {
  return {
    fps: { current: 0, average: 0, min: 999, max: 0 },
    frame: {
      frameTimeMs: 0,
      droppedFrames: 0,
      rafDurationMs: 0,
      gsapTickMs: 0,
      jsFrameCostMs: 0,
    },
    video: {
      currentTime: 0,
      targetTime: 0,
      playbackRate: 1,
      readyState: 0,
      bufferedPercent: 0,
      decodeHealth: 'unknown',
      syncMode: '—',
      seekCount: 0,
      avgSeekLatencyMs: 0,
      lastSeekLatencyMs: 0,
      resolution: '',
      source: '',
    },
    scroll: {
      scrollProgress: 0,
      filmProgress: 0,
      activeSection: 'arrival' as SectionId,
      lenisVelocity: 0,
      lenisDirection: 0,
      scrollSpeed: 0,
    },
    system: {
      memoryMb: 0,
      jsHeapMb: 0,
      heapGrowthMb: 0,
      listenerCountEstimate: 0,
      activeAnimationCount: 0,
      activeRafCount: 0,
      layerCountEstimate: 0,
      longTaskCount: 0,
      gcSpikeCount: 0,
    },
    environment: {
      devicePixelRatio: 1,
      viewport: '',
      browser: '',
      gpuVendor: 'unavailable',
      reducedMotion: false,
      touchDevice: false,
      batterySaver: false,
      saveData: false,
      networkType: 'unknown',
      performanceMode: 'idle',
    },
    pipeline: {
      styleRecalcMs: 0,
      layoutMs: 0,
      paintMs: 0,
      compositeMs: 0,
    },
    reactRenderCount: 0,
    handlerTimings: {},
    uptimeMs: 0,
  }
}

export class MetricsStore {
  readonly snapshot = createInitialSnapshot()

  private readonly fpsRing = new Float32Array(FPS_RING)
  private fpsRingIndex = 0
  private fpsRingCount = 0

  private readonly seekRing = new Float32Array(SEEK_RING)
  private seekRingIndex = 0
  private seekRingCount = 0

  private readonly lenisRing = new Float32Array(TIMING_RING)
  private lenisRingIndex = 0

  private readonly gsapRing = new Float32Array(TIMING_RING)
  private gsapRingIndex = 0

  private readonly filmRing = new Float32Array(TIMING_RING)
  private filmRingIndex = 0

  private readonly handlerRings = new Map<FilmHandlerName, Float32Array>()

  private startedAt = performance.now()
  private initialHeap = 0
  private lastHeap = 0
  private lastScrollProgress = 0
  private lastScrollAt = 0
  private frameStartAt = 0
  private lastFrameAt = 0
  private videoElement: HTMLVideoElement | null = null
  private targetTime = 0
  private pendingSeekStart = 0
  private lastDecodeAt = 0
  private lastVideoTime = 0

  private listeners = new Set<(snapshot: PerfSnapshot) => void>()

  subscribe(listener: (snapshot: PerfSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot)
    }
  }

  setVideoElement(video: HTMLVideoElement | null): void {
    this.videoElement = video
    if (video) {
      this.snapshot.video.source = video.currentSrc || video.src || ''
      this.updateVideoStatic()
    }
  }

  setVideoSyncMode(mode: string): void {
    this.snapshot.video.syncMode = mode
  }

  beginFrame(): void {
    this.frameStartAt = performance.now()
  }

  endFrame(gsapTickMs: number): void {
    const now = performance.now()
    const delta = this.lastFrameAt > 0 ? now - this.lastFrameAt : 16.67
    this.lastFrameAt = now

    const fps = delta > 0 ? 1000 / delta : 0
    this.pushFps(fps)

    const frame = this.snapshot.frame
    frame.frameTimeMs = delta
    frame.gsapTickMs = gsapTickMs
    frame.rafDurationMs = now - this.frameStartAt
    frame.jsFrameCostMs = frame.rafDurationMs

    if (delta > 20) {
      frame.droppedFrames += Math.max(0, Math.round(delta / 16.67) - 1)
    }

    this.snapshot.uptimeMs = now - this.startedAt
    this.updateEnvironmentMode()
    this.updateVideoDynamic()
    this.updateSystem()
    this.updatePipelineEstimates()
  }

  recordLenis(ms: number): void {
    this.lenisRing[this.lenisRingIndex++ % TIMING_RING] = ms
    this.snapshot.frame.rafDurationMs = ms
  }

  recordGsapTick(ms: number): void {
    this.gsapRing[this.gsapRingIndex++ % TIMING_RING] = ms
    this.snapshot.frame.gsapTickMs = ms
  }

  recordFilmSync(ms: number): void {
    this.filmRing[this.filmRingIndex++ % TIMING_RING] = ms
  }

  private handlerRingIndex = 0

  recordOverlaySync(name: FilmHandlerName, ms: number): void {
    let ring = this.handlerRings.get(name)
    if (!ring) {
      ring = new Float32Array(TIMING_RING)
      this.handlerRings.set(name, ring)
    }
    const timings = this.snapshot.handlerTimings[name] ?? { ...EMPTY_HANDLER }
    timings.lastMs = ms
    timings.totalMs += ms
    this.snapshot.handlerTimings[name] = timings
    ring[this.handlerRingIndex++ % TIMING_RING] = ms
  }

  recordNavbarSync(ms: number): void {
    this.recordOverlaySync('navbar', ms)
  }

  recordVideoTarget(targetTime: number): void {
    this.targetTime = targetTime
    this.snapshot.video.targetTime = targetTime
  }

  recordVideoDrive(ms: number): void {
    void ms
    this.updateVideoDynamic()
  }

  beginVideoSeek(): void {
    this.pendingSeekStart = performance.now()
  }

  endVideoSeek(): void {
    if (this.pendingSeekStart <= 0) return
    const latency = performance.now() - this.pendingSeekStart
    this.pendingSeekStart = 0
    this.pushSeek(latency)
    this.snapshot.video.seekCount += 1
    this.snapshot.video.lastSeekLatencyMs = latency
    this.snapshot.video.avgSeekLatencyMs = this.averageSeek()
  }

  updateScroll(data: {
    scrollProgress?: number
    filmProgress?: number
    activeSection?: SectionId
    lenisVelocity?: number
    lenisDirection?: number
  }): void {
    const scroll = this.snapshot.scroll
    const now = performance.now()

    if (data.scrollProgress !== undefined) {
      const dt = now - this.lastScrollAt
      if (dt > 0) {
        scroll.scrollSpeed = Math.abs(data.scrollProgress - this.lastScrollProgress) / dt
      }
      this.lastScrollProgress = data.scrollProgress
      this.lastScrollAt = now
      scroll.scrollProgress = data.scrollProgress
    }

    if (data.filmProgress !== undefined) scroll.filmProgress = data.filmProgress
    if (data.activeSection !== undefined) scroll.activeSection = data.activeSection
    if (data.lenisVelocity !== undefined) scroll.lenisVelocity = data.lenisVelocity
    if (data.lenisDirection !== undefined) scroll.lenisDirection = data.lenisDirection
  }

  incrementReactRender(): void {
    this.snapshot.reactRenderCount += 1
  }

  recordLongTask(): void {
    this.snapshot.system.longTaskCount += 1
  }

  recordGcSpike(): void {
    this.snapshot.system.gcSpikeCount += 1
  }

  setEnvironment(env: Partial<EnvironmentMetrics>): void {
    Object.assign(this.snapshot.environment, env)
  }

  setActiveRafCount(count: number): void {
    this.snapshot.system.activeRafCount = count
  }

  setActiveAnimationCount(count: number): void {
    this.snapshot.system.activeAnimationCount = count
  }

  setLayerCountEstimate(count: number): void {
    this.snapshot.system.layerCountEstimate = count
  }

  setListenerEstimate(count: number): void {
    this.snapshot.system.listenerCountEstimate = count
  }

  initHeap(): void {
    const heap = this.readHeapMb()
    this.initialHeap = heap
    this.lastHeap = heap
  }

  private pushFps(fps: number): void {
    this.fpsRing[this.fpsRingIndex++ % FPS_RING] = fps
    if (this.fpsRingCount < FPS_RING) this.fpsRingCount++

    const fpsMetrics = this.snapshot.fps
    fpsMetrics.current = fps
    fpsMetrics.min = Math.min(fpsMetrics.min === 999 ? fps : fpsMetrics.min, fps)
    fpsMetrics.max = Math.max(fpsMetrics.max, fps)

    let sum = 0
    for (let i = 0; i < this.fpsRingCount; i++) sum += this.fpsRing[i]
    fpsMetrics.average = this.fpsRingCount > 0 ? sum / this.fpsRingCount : 0
  }

  private pushSeek(latency: number): void {
    this.seekRing[this.seekRingIndex++ % SEEK_RING] = latency
    if (this.seekRingCount < SEEK_RING) this.seekRingCount++
  }

  private averageSeek(): number {
    if (this.seekRingCount === 0) return 0
    let sum =  0
    for (let i = 0; i < this.seekRingCount; i++) sum += this.seekRing[i]
    return sum / this.seekRingCount
  }

  private readHeapMb(): number {
    const mem = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number }
    }
    if (!mem.memory) return 0
    return mem.memory.usedJSHeapSize / (1024 * 1024)
  }

  private updateSystem(): void {
    const system = this.snapshot.system
    const heap = this.readHeapMb()
    system.jsHeapMb = heap
    system.heapGrowthMb = heap - this.initialHeap

    const mem = performance as Performance & { memory?: { totalJSHeapSize: number } }
    if (mem.memory) {
      system.memoryMb = mem.memory.totalJSHeapSize / (1024 * 1024)
    }

    if (this.lastHeap > 0 && heap < this.lastHeap - 2) {
      this.recordGcSpike()
    }
    this.lastHeap = heap
  }

  private updateVideoStatic(): void {
    const video = this.videoElement
    if (!video) return
    this.snapshot.video.source = video.currentSrc || video.src || ''
    this.snapshot.video.resolution =
      video.videoWidth > 0 ? `${video.videoWidth}×${video.videoHeight}` : 'pending'
  }

  private updateVideoDynamic(): void {
    const video = this.videoElement
    const videoMetrics = this.snapshot.video
    if (!video) return

    videoMetrics.currentTime = video.currentTime
    videoMetrics.targetTime = this.targetTime
    videoMetrics.playbackRate = video.playbackRate
    videoMetrics.readyState = video.readyState

    if (video.videoWidth > 0) {
      videoMetrics.resolution = `${video.videoWidth}×${video.videoHeight}`
    }

    let bufferedEnd = 0
    if (video.buffered.length > 0 && video.duration > 0) {
      bufferedEnd = video.buffered.end(video.buffered.length - 1)
      videoMetrics.bufferedPercent = (bufferedEnd / video.duration) * 100
    } else {
      videoMetrics.bufferedPercent = 0
    }

    const now = performance.now()
    const timeMoved = Math.abs(video.currentTime - this.lastVideoTime) > 0.0001
    if (timeMoved) {
      const sinceLast = now - this.lastDecodeAt
      if (sinceLast > 80 && videoMetrics.lastSeekLatencyMs > 50) {
        videoMetrics.decodeHealth = 'degraded'
      } else if (sinceLast > 200) {
        videoMetrics.decodeHealth = 'stalled'
      } else {
        videoMetrics.decodeHealth = 'good'
      }
      this.lastDecodeAt = now
      this.lastVideoTime = video.currentTime
    } else if (videoMetrics.seekCount > 0 && videoMetrics.lastSeekLatencyMs > 80) {
      videoMetrics.decodeHealth = 'degraded'
    }
  }

  private updatePipelineEstimates(): void {
    const pipeline = this.snapshot.pipeline
    const filmMs = this.snapshot.frame.gsapTickMs
    const overlayTotal = Object.values(this.snapshot.handlerTimings).reduce(
      (sum, t) => sum + (t?.lastMs ?? 0),
      0,
    )

    pipeline.styleRecalcMs = overlayTotal * 0.55
    pipeline.layoutMs = overlayTotal * 0.1
    pipeline.paintMs = overlayTotal * 0.25
    pipeline.compositeMs = Math.max(0, filmMs - overlayTotal) * 0.4
  }

  private updateEnvironmentMode(): void {
    const fps = this.snapshot.fps.current
    let mode: PerformanceMode = 'idle'
    if (fps >= 55) mode = 'good'
    else if (fps >= 40) mode = 'degraded'
    else if (fps > 0) mode = 'critical'
    this.snapshot.environment.performanceMode = mode
  }
}

export const metricsStore = new MetricsStore()
