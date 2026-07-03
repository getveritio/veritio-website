/**
 * Design tokens for the hero "Evidence Console" panel.
 *
 * The console is a deliberate dark-instrument contrast moment on an otherwise
 * light page, so it does NOT use Tailwind classes: Remotion compositions are
 * styled inline (frame-interpolated values cannot be utility classes), and
 * keeping every color here guarantees the animated panel and the static
 * no-JS fallback stay visually identical. Values derive from the site palette
 * in src/styles/global.css (`--color-surface-invert`, `--color-accent`, …).
 */
import type { RiskLevel } from '@veritio/core/risk-score'

export const consoleTheme = {
  /** Panel backdrop — one step darker than --color-surface-invert (#10231b). */
  bg: '#0c1a14',
  /** Inset card surfaces — equals --color-surface-invert. */
  panel: '#10231b',
  /** Hairline rules on the dark surface. */
  line: 'rgba(231, 239, 233, 0.09)',
  lineStrong: 'rgba(231, 239, 233, 0.16)',
  /** Primary/secondary text on the dark surface. */
  text: '#e7efe9',
  textSoft: '#9db4a6',
  textFaint: '#5f7568',
  /** Brand greens — equal --color-accent / --color-evergreen. */
  accent: '#2f6f57',
  accentBright: '#4da080',
  evergreen: '#1f3b30',
  /** Mono stack — matches --font-mono in global.css. */
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
  sans: 'Inter, "Inter Fallback", ui-sans-serif, system-ui, sans-serif',
} as const

/**
 * One color per protocol risk level (none|low|medium|high|critical), used for
 * risk chips, gauge bands, and the escalation trail. Chosen for legibility on
 * `consoleTheme.bg` while escalating green → amber → red like an instrument.
 */
export const levelColor: Record<RiskLevel, string> = {
  none: '#5f7568',
  low: '#4da080',
  medium: '#d8b13c',
  high: '#e08a3c',
  critical: '#e25d55',
}
