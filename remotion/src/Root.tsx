import React from 'react'
import { Composition } from 'remotion'
import { EvidenceStream } from './EvidenceStream'
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from './theme'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EvidenceStream"
        component={EvidenceStream}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  )
}
