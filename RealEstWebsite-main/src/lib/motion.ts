/** Film is 24fps — UI runs at display refresh; bridge the mismatch with curves + soft play. */
export const VIDEO_FPS = 24
export const VIDEO_FRAME = 1 / VIDEO_FPS

/** Snap time to the nearest encoded frame (used only for rare corrective seeks). */
export function quantizeToFrame(time: number, fps = VIDEO_FPS): number {
  return Math.round(time * fps) / fps
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Hermite smoothstep — more intermediate values than linear fades. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Ken Perlin smootherstep — premium cinematic ease in/out. */
export function smootherstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Opacity across a progress window with soft edges.
 * Fully transparent outside [start, end]; soft plateau in the middle.
 */
export function windowOpacity(
  progress: number,
  fadeInStart: number,
  fadeInEnd: number,
  fadeOutStart: number,
  fadeOutEnd: number,
): number {
  if (progress <= fadeInStart || progress >= fadeOutEnd) return 0
  if (progress < fadeInEnd) {
    return softerPeak(
      smootherstep((progress - fadeInStart) / (fadeInEnd - fadeInStart)),
    )
  }
  if (progress > fadeOutStart) {
    return softerPeak(
      1 -
        smootherstep((progress - fadeOutStart) / (fadeOutEnd - fadeOutStart)),
    )
  }
  return softerPeak(1)
}

/** Soft ceiling — never snaps to a hard 1.0 plateau. */
export function softerPeak(t: number, peak = 0.965): number {
  return clamp(t, 0, 1) * peak
}

/**
 * Raised-cosine lobe weight for continuous overlapping chapters.
 * Neighbors coexist at low opacity — cinematic dissolves, not hard cuts.
 */
export function raisedCosine(distance: number, halfWidth: number): number {
  const d = Math.abs(distance) / halfWidth
  if (d >= 1) return 0
  return 0.5 * (1 + Math.cos(Math.PI * d))
}

/** Cinematic ease-out for Lenis scrollTo / GSAP (gentle deceleration). */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5)
}

/** Soft ease-in-out for programmatic scrolls. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
