'use client'

import { useId } from 'react'
import type { CSSProperties } from 'react'

type BorderBeamProps = {
  className?: string
  /** @deprecated – no longer used; kept for call-site compatibility */
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
  style?: CSSProperties
}

/**
 * Border Beam — a neon comet that races along the perimeter.
 *
 * Implementation notes:
 *  • pathLength="100" on the <rect> normalises the total perimeter to 100 units.
 *  • stroke-dasharray="4 96" → 4% visible comet, 96% gap → tight comet head.
 *  • The linearGradient fades from transparent → neon-white-hot → colorTo → transparent
 *    to simulate a head + trailing glow.
 *  • Multiple drop-shadow filters produce the corona bloom effect.
 *  • animation-delay is negative so the comet starts mid-run (no cold-start lag).
 */
export default function BorderBeam({
  className = '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  size: _size,
  duration = 6,
  delay = 0,
  colorFrom = '#c8ff00',
  colorTo = '#00ffd1',
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
  style,
}: BorderBeamProps) {
  const id = useId().replace(/:/g, '')
  const beamDelay = -(duration * initialOffset) / 100 - delay

  return (
    <svg
      aria-hidden="true"
      className={`border-beam${reverse ? ' reverse' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        '--beam-duration': `${duration}s`,
        '--beam-delay': `${beamDelay}s`,
        '--beam-border-width': `${borderWidth}px`,
        ...style,
      } as CSSProperties}
    >
      <defs>
        {/* Comet gradient: transparent tail → bright hot-white → neon → transparent */}
        <linearGradient id={`bb-g-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={colorFrom}  stopOpacity="0"    />
          <stop offset="28%"  stopColor={colorFrom}  stopOpacity=".55"  />
          <stop offset="58%"  stopColor="#ffffff"    stopOpacity=".9"   />
          <stop offset="72%"  stopColor={colorTo}    stopOpacity="1"    />
          <stop offset="88%"  stopColor={colorTo}    stopOpacity=".35"  />
          <stop offset="100%" stopColor={colorTo}    stopOpacity="0"    />
        </linearGradient>
      </defs>

      <rect
        className="border-beam-line"
        x="1"
        y="1"
        width="98"
        height="98"
        rx="4"
        ry="4"
        pathLength="100"
        stroke={`url(#bb-g-${id})`}
        strokeWidth={borderWidth}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    </svg>
  )
}
