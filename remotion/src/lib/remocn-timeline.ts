/**
 * Remocn-inspired timeline helpers: deterministic frame → progress utilities.
 * Copied pattern from remocn.dev (timeline atoms as pure functions of frame).
 */
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Ease-out cubic progress over [start, start+duration] frames. */
export function revealProgress(frame: number, start: number, duration = 14): number {
  return clamp01(
    interpolate(frame, [start, start + duration], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: (t) => 1 - (1 - t) ** 3,
    }),
  )
}

export function useReveal(start: number, duration = 14): number {
  const frame = useCurrentFrame()
  return revealProgress(frame, start, duration)
}

export function useSpringIn(start: number, delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({
    frame: frame - start - delay,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.7 },
  })
}

export function framesFor(seconds: number, fps: number): number {
  return Math.round(seconds * fps)
}
