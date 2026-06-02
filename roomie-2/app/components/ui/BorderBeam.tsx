'use client'

import { useId } from 'react'
import type { CSSProperties } from 'react'

type BorderBeamProps = {
  className?: string
  size?: number
  duration?: number
  delay?: number
  anchor?: number
  colorFrom?: string
  colorTo?: string
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
  style?: CSSProperties
}

export default function BorderBeam({
  className = '',
  size = 140,
  duration = 7,
  delay = 0,
  colorFrom = '#c8ff00',
  colorTo = '#00ffd1',
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.25,
  style,
}: BorderBeamProps) {
  const gradientId = useId().replace(/:/g, '')
  const beamDelay = -(duration * initialOffset) / 100 - delay
  return (
    <svg
      aria-hidden="true"
      className={`border-beam${reverse ? ' reverse' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        '--beam-size': `${size}px`,
        '--beam-duration': `${duration}s`,
        '--beam-delay': `${beamDelay}s`,
        '--beam-color-from': colorFrom,
        '--beam-color-to': colorTo,
        '--beam-border-width': `${borderWidth}px`,
        ...style,
      } as CSSProperties}
    >
      <defs>
        <linearGradient id={`roomie-border-beam-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colorFrom} stopOpacity="0" />
          <stop offset="35%" stopColor={colorFrom} stopOpacity=".95" />
          <stop offset="72%" stopColor={colorTo} stopOpacity=".72" />
          <stop offset="100%" stopColor={colorTo} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        className="border-beam-line"
        x="1.2"
        y="1.2"
        width="97.6"
        height="97.6"
        rx="4.2"
        ry="4.2"
        pathLength="100"
        stroke={`url(#roomie-border-beam-${gradientId})`}
        style={{ stroke: `url(#roomie-border-beam-${gradientId})` }}
      />
    </svg>
  )
}
