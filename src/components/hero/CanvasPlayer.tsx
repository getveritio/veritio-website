/**
 * Client island hosting the Remotion Player for the Cloud section's activity
 * episode canvas. Same contract as HeroPlayer: mount with
 * `client:only="react"` over the static `CanvasFallback.astro`; mount-time
 * `autoPlay` (imperative play() is racy); reduced motion pins to a still
 * inside the end-state hold (the loop tail fades to transparent). A separate
 * island from HeroPlayer because component props cannot cross the Astro
 * island boundary.
 */
import { useEffect, useState } from 'react'
import { Player } from '@remotion/player'
import {
  CANVAS_DURATION,
  CANVAS_FADE_OUT_START,
  CANVAS_FPS,
  CANVAS_H,
  CANVAS_W,
  EpisodeCanvas,
} from './EpisodeCanvas'

const STILL_FRAME = CANVAS_FADE_OUT_START - 12
const QUERY = '(prefers-reduced-motion: reduce)'

export default function CanvasPlayer() {
  const [reduced, setReduced] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const apply = () => setReduced(mq.matches)
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <Player
      key={reduced ? 'still' : 'looping'}
      component={EpisodeCanvas}
      durationInFrames={CANVAS_DURATION}
      compositionWidth={CANVAS_W}
      compositionHeight={CANVAS_H}
      fps={CANVAS_FPS}
      style={{ width: '100%', height: '100%' }}
      autoPlay={!reduced}
      initialFrame={reduced ? STILL_FRAME : 0}
      loop
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
    />
  )
}
