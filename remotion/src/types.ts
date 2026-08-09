export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'

export type StreamRow = {
  seq: number
  time: string
  action: string
  dot: string
  origin: string
  risk: number | null
  level: RiskLevel | null
  prev: string
  hash: string
  /** Frame when this row begins entering */
  at: number
}

/** Demo episode mirroring the §01 copy: agent → review/pipeline → deploy. */
export const STREAM_ROWS: StreamRow[] = [
  {
    seq: 1,
    time: '03:12:04',
    action: 'tool call',
    dot: '#06b6d4',
    origin: 'ai_agent·claude',
    risk: 0.12,
    level: 'low',
    prev: 'genesis',
    hash: 'a3f1c8',
    at: 24,
  },
  {
    seq: 2,
    time: '03:12:18',
    action: 'code change',
    dot: '#f59e0b',
    origin: 'ai_agent·claude',
    risk: 0.34,
    level: 'medium',
    prev: 'a3f1c8',
    hash: 'b7e204',
    at: 62,
  },
  {
    seq: 3,
    time: '03:14:02',
    action: 'review · approved',
    dot: '#22c55e',
    origin: 'user·m.chen',
    risk: 0.08,
    level: 'low',
    prev: 'b7e204',
    hash: 'c91d55',
    at: 100,
  },
  {
    seq: 4,
    time: '03:14:41',
    action: 'ci',
    dot: '#3b82f6',
    origin: 'service·github',
    risk: 0.15,
    level: 'low',
    prev: 'c91d55',
    hash: 'd0aa12',
    at: 138,
  },
  {
    seq: 5,
    time: '03:18:09',
    action: 'deploy',
    dot: '#10b981',
    origin: 'service·ship',
    risk: 0.81,
    level: 'critical',
    prev: 'd0aa12',
    hash: 'e4f773',
    at: 176,
  },
]

/** Cumulative episode rollup scores after each row (demo). */
export const ROLLUP_SCORES = [0.12, 0.34, 0.34, 0.34, 0.81]
