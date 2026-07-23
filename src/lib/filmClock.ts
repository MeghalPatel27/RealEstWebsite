import {
  progressFromVideoTime,
  videoTimeFromProgress,
} from '@/lib/constants'
import { clamp, quantizeToFrame } from '@/lib/motion'

export type FilmState = {
  /** Smoothed cinematic progress (0–1) — master timeline for all UI */
  progress: number
  /** Scroll intent (raw Lenis), before film smoothing */
  scrollProgress: number
  /** Seconds on the film playhead used for UI */
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

/**
 * Soft-drive the decoder: prefer native playback toward the target
 * instead of seeking every frame (the main source of cinematic choppiness).
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

  // Settled — hold frame, decoder idle
  if (Math.abs(delta) < 0.045) {
    if (!video.paused) video.pause()
    video.playbackRate = 1
    return
  }

  // Forward: play at adaptive rate so frames advance continuously at 24fps
  if (delta > 0) {
    if (delta > 1.35) {
      // Large jump (nav click) — one corrective seek, then soft play resumes
      if (!video.paused) video.pause()
      video.playbackRate = 1
      video.currentTime = quantizeToFrame(targetTime)
      return
    }
    video.playbackRate = clamp(0.55 + delta * 2.1, 0.45, 2.6)
    if (video.paused) {
      void video.play().catch(() => {
        /* autoplay policies — stay paused */
      })
    }
    return
  }

  // Backward: native reverse is unreliable — infrequent quantized seeks only
  if (delta < -0.06) {
    if (!video.paused) video.pause()
    video.playbackRate = 1
    video.currentTime = quantizeToFrame(targetTime)
  }
}

/** Resolve UI progress: lock to footage while playing, else smoothed scroll. */
export function resolveFilmProgress(
  video: HTMLVideoElement | null,
  smoothedScroll: number,
  duration: number,
): { progress: number; videoTime: number } {
  if (video && !video.paused && video.readyState >= 2) {
    const videoTime = video.currentTime
    return {
      videoTime,
      progress: progressFromVideoTime(videoTime, duration),
    }
  }

  const videoTime = videoTimeFromProgress(smoothedScroll, duration)
  return { progress: smoothedScroll, videoTime }
}
