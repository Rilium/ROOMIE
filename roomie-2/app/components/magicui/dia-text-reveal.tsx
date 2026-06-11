'use client'

import { useEffect, useRef, useState, type ComponentType, type RefAttributes } from 'react'
import { motion, type DOMMotionComponents, type HTMLMotionProps, type MotionProps } from 'motion/react'

const motionElements = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  li: motion.li,
  p: motion.p,
  section: motion.section,
  span: motion.span,
} as const

type MotionElementType = Extract<keyof DOMMotionComponents, keyof typeof motionElements>
type MotionComponent = ComponentType<Omit<HTMLMotionProps<'div'>, 'ref'> & RefAttributes<HTMLElement>>

interface DiaTextRevealProps extends Omit<MotionProps, 'children'> {
  children: string
  className?: string
  duration?: number
  delay?: number
  as?: MotionElementType
  startOnView?: boolean
  animateOnHover?: boolean
}

export function DiaTextReveal({
  children,
  className,
  duration = 760,
  delay = 0,
  as: Component = 'div',
  startOnView = true,
  ...props
}: DiaTextRevealProps) {
  const MotionComponent = motionElements[Component] as MotionComponent
  const [revealed, setRevealed] = useState(false)
  const elementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true)
      return
    }

    if (!startOnView) {
      const t = setTimeout(() => setRevealed(true), delay)
      return () => clearTimeout(t)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setRevealed(true), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '-10% 0px -10% 0px' },
    )

    if (elementRef.current) observer.observe(elementRef.current)
    return () => observer.disconnect()
  }, [delay, startOnView])

  const letters = children.split('')
  const charDuration = Math.max(0.08, (duration / 1000) / Math.max(1, letters.length) * 2.2)
  const stagger = Math.min(0.055, charDuration * 0.5)

  return (
    <MotionComponent ref={elementRef} className={className} {...props} style={{ display: 'inline', ...((props as { style?: React.CSSProperties }).style ?? {}) }}>
      {letters.map((letter, i) =>
        letter === '\n' ? (
          <br key={`br-${i}`} />
        ) : (
          <motion.span
            key={`${i}-${letter}`}
            style={{ display: 'inline-block', whiteSpace: letter === ' ' ? 'pre' : undefined }}
            initial={{ opacity: 0, filter: 'blur(5px)' }}
            animate={revealed ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(5px)' }}
            transition={{
              duration: charDuration,
              delay: i * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {letter}
          </motion.span>
        ),
      )}
    </MotionComponent>
  )
}
