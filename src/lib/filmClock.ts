import { videoTimeFromProgress } from '@/lib/constants'
import {
  getVideoSyncEngine,
  resetVideoSyncEngine,
  type VideoDriveContext,
} from '@/lib/video/VideoSyncEngine'

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

export type DriveOptions = {
  video: HTMLVideoElement
  targetTime: number
  pageProgress: number
  reducedMotion: boolean
  /** Master ticker frame id — prevents duplicate drives in one frame. */
  frameId?: number
}

/**
 * Drive the hero film toward scroll intent via the VideoSyncEngine.
 */
export function driveVideoToward({
  video,
  targetTime,
  pageProgress,
  reducedMotion,
  frameId = 0,
}: DriveOptions): void {
  const ctx: VideoDriveContext = {
    video,
    targetTime,
    pageProgress,
    reducedMotion,
    frameId,
  }
  getVideoSyncEngine().drive(ctx)
}

/** Reset per-session engine state (e.g. when swapping video elements). */
export function resetVideoDrive(): void {
  resetVideoSyncEngine()
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

/** Expose current sync mode for Phase 1 overlay / DevTools. */
export function getVideoSyncMode(): string {
  return getVideoSyncEngine().mode
}
