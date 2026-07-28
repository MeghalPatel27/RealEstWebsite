import { perf } from '@/lib/performance'
import { clamp, quantizeToFrame, VIDEO_FRAME } from '@/lib/motion'
import { VIDEO_SYNC_CONFIG, type VideoSyncMode } from './videoConfig'

export type VideoDriveContext = {
  video: HTMLVideoElement
  targetTime: number
  pageProgress: number
  reducedMotion: boolean
  /** Master ticker frame id — coalesces duplicate calls in one tick. */
  frameId: number
}

type EngineState = {
  mode: VideoSyncMode
  lastDriveFrameId: number
  lastForwardSeekAt: number
  lastReverseSeekAt: number
  lastReverseSeekTime: number
  visibilityHidden: boolean
}

function createState(): EngineState {
  return {
    mode: 'settled',
    lastDriveFrameId: -1,
    lastForwardSeekAt: 0,
    lastReverseSeekAt: 0,
    lastReverseSeekTime: -1,
    visibilityHidden: false,
  }
}

/**
 * Scroll-scrub sync engine — restored to pre–Phase-2 drive policy.
 *
 * Forward: soft-play up to 3.5× inside the seek threshold; seek when delta ≥ 0.22s.
 * Reverse: throttled quantized seeks (~30Hz).
 *
 * Phase 2 regressions removed: pending-seek gate, buffer gate, fast-scroll seek-only,
 * narrowed play band, 1.45× rate cap, perf-tier throttling, duplicate-seek blocking.
 */
export class VideoSyncEngine {
  private state = createState()

  get mode(): VideoSyncMode {
    return this.state.mode
  }

  reset(): void {
    this.state = createState()
  }

  drive(ctx: VideoDriveContext): void {
    const { video, targetTime, pageProgress, reducedMotion, frameId } = ctx

    if (this.state.lastDriveFrameId === frameId) return
    this.state.lastDriveFrameId = frameId

    if (pageProgress >= VIDEO_SYNC_CONFIG.FILM_HIDE_PROGRESS) {
      this.enterHidden(video)
      return
    }

    this.setVisibility(video, true)

    if (reducedMotion) {
      this.state.mode = 'reduced-motion'
      return
    }

    const current = video.currentTime
    const delta = targetTime - current
    const abs = Math.abs(delta)

    if (abs < VIDEO_SYNC_CONFIG.SETTLE_EPS_SEC) {
      this.state.mode = 'settled'
      if (!video.paused) video.pause()
      video.playbackRate = 1
      return
    }

    if (delta > 0) {
      this.driveForward(video, targetTime, delta)
      return
    }

    this.driveReverse(video, targetTime)
  }

  private enterHidden(video: HTMLVideoElement): void {
    this.state.mode = 'hidden'
    if (!video.paused) video.pause()
    this.setVisibility(video, false)
  }

  private setVisibility(video: HTMLVideoElement, visible: boolean): void {
    const hidden = !visible
    if (this.state.visibilityHidden === hidden) return
    this.state.visibilityHidden = hidden
    video.style.visibility = visible ? 'visible' : 'hidden'
  }

  private driveForward(
    video: HTMLVideoElement,
    targetTime: number,
    delta: number,
  ): void {
    const now = performance.now()

    if (
      delta >= VIDEO_SYNC_CONFIG.FORWARD_SEEK_DELTA_SEC &&
      now - this.state.lastForwardSeekAt >= VIDEO_SYNC_CONFIG.FORWARD_SEEK_MIN_MS
    ) {
      this.state.mode = 'seek-forward'
      if (!video.paused) video.pause()
      video.playbackRate = 1
      const seekTime = quantizeToFrame(targetTime)
      perf.measureVideoSeek(video, seekTime, () => {
        video.currentTime = seekTime
      })
      this.state.lastForwardSeekAt = now
      return
    }

    this.state.mode = 'play-catchup'
    video.playbackRate = clamp(
      VIDEO_SYNC_CONFIG.PLAYBACK_RATE_MIN + delta * VIDEO_SYNC_CONFIG.PLAYBACK_RATE_GAIN,
      VIDEO_SYNC_CONFIG.PLAYBACK_RATE_MIN,
      VIDEO_SYNC_CONFIG.PLAYBACK_RATE_MAX,
    )
    if (video.paused) {
      void video.play().catch(() => {
        /* autoplay policies — stay paused */
      })
    }
  }

  private driveReverse(video: HTMLVideoElement, targetTime: number): void {
    this.state.mode = 'seek-reverse'
    if (!video.paused) video.pause()
    video.playbackRate = 1

    const now = performance.now()
    const quantized = quantizeToFrame(targetTime)
    const seekDelta = Math.abs(quantized - this.state.lastReverseSeekTime)
    const due =
      now - this.state.lastReverseSeekAt >= VIDEO_SYNC_CONFIG.REVERSE_SEEK_MIN_MS ||
      seekDelta >= VIDEO_FRAME * 2

    if (due) {
      this.state.lastReverseSeekAt = now
      this.state.lastReverseSeekTime = quantized
      perf.measureVideoSeek(video, quantized, () => {
        video.currentTime = quantized
      })
    }
  }
}

let engine: VideoSyncEngine | null = null

export function getVideoSyncEngine(): VideoSyncEngine {
  if (!engine) engine = new VideoSyncEngine()
  return engine
}

export function resetVideoSyncEngine(): void {
  engine?.reset()
}
