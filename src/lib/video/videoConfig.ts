import { VIDEO_FRAME } from '@/lib/motion'

/**
 * Video sync thresholds — aligned with pre–Phase-2 `filmClock` behavior.
 * Phase 2 regressions came from tightening these (play band, rate cap, gates).
 */
export const VIDEO_SYNC_CONFIG = {
  FILM_HIDE_PROGRESS: 0.86,

  /** Hold frame when within ~0.85 encoded frames of target. */
  SETTLE_EPS_SEC: VIDEO_FRAME * 0.85,

  /** Forward seek when soft-play would visibly lag the wheel. */
  FORWARD_SEEK_DELTA_SEC: 0.22,

  /** Minimum ms between forward corrective seeks. */
  FORWARD_SEEK_MIN_MS: 24,

  /** Reverse scrub interval — ~30fps, sparse enough to avoid stalls. */
  REVERSE_SEEK_MIN_MS: 33,

  /** Soft-play rate bounds (original filmClock curve). */
  PLAYBACK_RATE_MIN: 0.85,
  PLAYBACK_RATE_MAX: 3.5,
  PLAYBACK_RATE_GAIN: 4.2,
} as const

export type VideoSyncMode =
  | 'hidden'
  | 'settled'
  | 'play-catchup'
  | 'seek-forward'
  | 'seek-reverse'
  | 'reduced-motion'
