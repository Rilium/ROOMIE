'use client'

import { useApp } from '@/app/context/AppContext'

export default function BootLoader() {
  const { loading } = useApp()
  if (!loading) return null
  return (
    <div id="boot-loader" className="boot-loader" aria-hidden="true">
      <div className="boot-card">
        <div className="roomie-loader-brand">ROOMIE</div>
        <span className="roomie-chip" aria-hidden="true"></span>
        <div className="boot-copy">Prepariamo la room</div>
      </div>
    </div>
  )
}
