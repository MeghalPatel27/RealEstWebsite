import { videoTimeFromProgress } from '@/lib/constants'
import { clamp, quantizeToFrame, VIDEO_FRAME } from '@/lib/motion'

export type FilmState = {
  /** Cinematic progress (0–1) — follows scroll intent closely */
  progress: number
  /** Scroll intent (raw Lenis) */
  scrollProgress: number
  /** Seconds on the film playhead */
  videoTime: number
  /** performance.now() for micro-motion / breathing */
  now: number
}

export type FilmHandler = (state: FilmState) => void

type DriveOptions = {
  video: HTMLVideoElement
  targetTime: number
  pageProgress: number
  reducedMotion: boolean
}

/** ~30fps reverse scrub — tight enough to track, sparse enough to avoid stalls */
const REVERSE_SEEK_MIN_MS = 33
/** Forward: seek when soft-play would visibly lag the wheel */
const FORWARD_SEEK_DELTA = 0.22
const SETTLE_EPS = VIDEO_FRAME * 0.85

let lastReverseSeekAt = 0
let lastReverseSeekTime = -1
let lastForwardSeekAt = 0

/**
 * Keep the decoder glued to scroll target.
 * Soft-play for small lead; seek when the wheel pulls ahead.
 */
export function driveVideoToward({
  video,
  targetTime,
  pageProgress,
  reducedMotion,
}: DriveOptions): void {
  if (pageProgress >= 0.86) {
    if (!video.paused) video.pause()
    video.style.visibility = 'hidden'
    return
  }
  video.style.visibility = 'visible'

  if (reducedMotion) return

  const current = video.currentTime
  const delta = targetTime - current
  const abs = Math.abs(delta)

  // Settled — hold frame
  if (abs < SETTLE_EPS) {
    if (!video.paused) video.pause()
    video.playbackRate = 1
    return
  }

  // Forward
  if (delta > 0) {
    const now = performance.now()
    // Large / mid gaps: snap so the picture stays on the scroll beat
    if (delta >= FORWARD_SEEK_DELTA && now - lastForwardSeekAt >= 24) {
      if (!video.paused) video.pause()
      video.playbackRate = 1
      video.currentTime = quantizeToFrame(targetTime)
      lastForwardSeekAt = now
      return
    }

    // Small lead: native play catches up without a seek hitch
    video.playbackRate = clamp(0.85 + delta * 4.2, 0.85, 3.5)
    if (video.paused) {
      void video.play().catch(() => {
        /* autoplay policies — stay paused */
      })
    }
    return
  }

  // Backward — throttled quantized seeks
  if (!video.paused) video.pause()
  video.playbackRate = 1

  const now = performance.now()
  const quantized = quantizeToFrame(targetTime)
  const seekDelta = Math.abs(quantized - lastReverseSeekTime)
  const due =
    now - lastReverseSeekAt >= REVERSE_SEEK_MIN_MS || seekDelta >= VIDEO_FRAME * 2

  if (due) {
    lastReverseSeekAt = now
    lastReverseSeekTime = quantized
    video.currentTime = quantized
  }
}

/**
 * UI progress tracks scroll intent (not the decoder playhead).
 * Locking to video while it soft-plays was the main “out of track” feel.
 */
export function resolveFilmProgress(
  video: HTMLVideoElement | null,
  smoothedScroll: number,
  duration: number,
): { progress: number; videoTime: number } {
  const videoTime =
    video && video.readyState >= 2
      ? video.currentTime
      : videoTimeFromProgress(smoothedScroll, duration)

  return { progress: smoothedScroll, videoTime }
}
