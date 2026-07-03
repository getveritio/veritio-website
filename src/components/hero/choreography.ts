/**
 * Frame timing shared by the hero composition and the Player island.
 *
 * Everything in the console derives from `useCurrentFrame()` against these
 * constants — no timers or state — so playback is deterministic and the
 * Player's `loop` restart is frame-exact. Kept separate from the components
 * so EventFeed and RiskGauge stay in sync without importing each other.
 */

export const FPS = 30
/** 16s loop. */
export const DURATION_IN_FRAMES = 480
export const COMPOSITION_WIDTH = 1120
export const COMPOSITION_HEIGHT = 640

/** Frame at which each of the four audit-event rows starts entering. */
export const ENTER_FRAMES = [18, 100, 182, 264] as const

/** Frames a row takes to fade/slide in. */
export const ROW_IN = 20
/** Delay after a row enters before its chain-link segment starts drawing. */
export const LINK_DELAY = 14
/** Frames the chain-link segment takes to draw. */
export const LINK_IN = 16

/** The strip-chart trace starts easing toward the new rollup shortly after a row lands. */
export const TRACE_DELAY = 8
export const TRACE_IN = 22

/** "chain verified" status flips on after the last link has drawn. */
export const VERIFIED_AT = 330

/** Panel cross-fade window that hides the loop restart. */
export const FADE_IN_END = 12
export const FADE_OUT_START = 452
export const FADE_OUT_END = 478
