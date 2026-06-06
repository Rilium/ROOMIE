'use client'

import type React from 'react'

interface ShineBorderProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  style?: React.CSSProperties
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
}

export function ShineBorder({
  className,
  duration = 8,
  delay = 0,
  colorFrom = '#C8FF00',
  colorTo = '#00FFD1',
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: ShineBorderProps) {
  const offsetDelay = -((duration * initialOffset) / 100) - delay

  return (
    <span
      className={`shine-border${reverse ? ' reverse' : ''}${className ? ` ${className}` : ''}`}
      style={{
        '--shine-duration': `${duration}s`,
        '--shine-delay': `${offsetDelay}s`,
        '--shine-border-width': `${borderWidth}px`,
        '--shine-color-from': colorFrom,
        '--shine-color-to': colorTo,
        ...style,
      } as React.CSSProperties}
      aria-hidden="true"
    />
  )
}
