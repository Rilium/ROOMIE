'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/app/context/AppContext'

export default function BootLoader() {
  const { loading } = useApp()
  const [mounted, setMounted] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const maxT = setTimeout(() => {
      setExiting(true)
      setTimeout(() => setMounted(false), 420)
    }, 3500)
    if (!loading) {
      setExiting(true)
      const t = setTimeout(() => setMounted(false), 420)
      return () => {
        clearTimeout(t)
        clearTimeout(maxT)
      }
    }
    return () => clearTimeout(maxT)
  }, [loading])

  if (!mounted) return null
  return (
    <div id="boot-loader" className={`boot-loader${exiting ? ' boot-out' : ''}`} aria-hidden="true">
      <div className="boot-card">
        <div className="boot-shell">
          <div className="roomie-loader-brand">ROOMIE</div>
          <span className="roomie-chip" aria-hidden="true"></span>
          <div className="boot-status-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="boot-copy">Prepariamo la room</div>
        </div>
      </div>
    </div>
  )
}
