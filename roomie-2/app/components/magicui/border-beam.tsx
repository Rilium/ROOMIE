'use client'

import type React from 'react'
import { useId } from 'react'
import { motion, type Transition } from 'motion/react'

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  transition?: Transition
  className?: string
  style?: React.CSSProperties
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
}

export function BorderBeam({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) {
  const gradientId = useId()
  const beamSize = Math.max(6, Math.min(26, size / 8))
  const dash = `${beamSize} ${100 - beamSize}`
  const start = reverse ? 100 - initialOffset : initialOffset
  const end = reverse ? -initialOffset : 100 + initialOffset

  return (
    <svg
      className="magic-border-beam"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="35%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      <motion.rect
        className={`magic-border-beam-line${className ? ` ${className}` : ''}`}
        x="0.75"
        y="0.75"
        width="98.5"
        height="98.5"
        rx="4"
        ry="4"
        pathLength="100"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={borderWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ strokeDashoffset: start }}
        animate={{ strokeDashoffset: end }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </svg>
  )
}
