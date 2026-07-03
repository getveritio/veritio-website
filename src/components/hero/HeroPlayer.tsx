/**
 * Client island hosting the Remotion Player for the hero Evidence Console.
 *
 * Must be mounted with `client:only="react"` — the Player touches browser
 * globals and cannot be server-rendered; the server-rendered
 * `HeroConsoleFallback.astro` sits underneath in the same slot so no-JS
 * visitors and the pre-hydration paint always show a complete panel.
 *
 * Playback uses the Player's mount-time `autoPlay` (the documented reliable
 * path) instead of imperative play()/seekTo(), which proved racy against the
 * Player's internal readiness. Because this island never SSRs, `window` is
 * available during the first render, so the `prefers-reduced-motion` choice
 * is made synchronously before the Player mounts; preference changes remount
 * it via `key`. Reduced motion pins the composition to a fully escalated
 * still frame inside the end-state hold (the loop's tail cross-fades to
 * transparent, so the literal last frame would be blank). This is the site's
 * only client JavaScript.
 */
import { useEffect, useState } from 'react'
import { Player } from '@remotion/player'
import { EvidenceConsole } from './EvidenceConsole'
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
  DURATION_IN_FRAMES,
  FADE_OUT_START,
  FPS,
} from './choreography'

/** Still frame for reduced motion: inside the end-state hold, before the loop fade-out. */
const STILL_FRAME = FADE_OUT_START - 12

const QUERY = '(prefers-reduced-motion: reduce)'

export default function HeroPlayer() {
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
      component={EvidenceConsole}
      durationInFrames={DURATION_IN_FRAMES}
      compositionWidth={COMPOSITION_WIDTH}
      compositionHeight={COMPOSITION_HEIGHT}
      fps={FPS}
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
