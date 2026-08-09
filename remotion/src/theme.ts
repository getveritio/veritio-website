/** Veritio Cloud dark ops-console tokens for the marketing evidence-stream clip. */
export const theme = {
  bg: '#09090b',
  card: '#18181b',
  muted: '#27272a',
  border: 'rgba(255, 255, 255, 0.1)',
  grid: 'rgba(255, 255, 255, 0.07)',
  foreground: '#fafafa',
  mutedForeground: '#a1a1aa',
  emerald: '#189537',
  emeraldSoft: 'rgba(24, 149, 55, 0.18)',
  risk: {
    none: '#a1a1aa',
    low: '#a1a1aa',
    medium: '#d97706',
    high: '#ef4444',
    critical: '#dc2626',
  },
  action: {
    tool: '#06b6d4',
    code: '#f59e0b',
    review: '#22c55e',
    ci: '#3b82f6',
    deploy: '#10b981',
    agent: '#8b5cf6',
  },
} as const

export const FPS = 30
export const WIDTH = 720
export const HEIGHT = 496
export const DURATION_FRAMES = FPS * 14
/**
 * The clip ends on the same empty panel it starts from, so the `loop` restart
 * reads as one continuous stream instead of a cut.
 */
export const OUTRO_FRAMES = 34
/** Inner content width of the risk-chart card (720 − page/card/chart padding). */
export const CHART_WIDTH = 620
