'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/app/context/AppContext'
import RoomieLogoText from '@/app/components/ui/RoomieLogoText'
import { subscribeApiPending } from '@/lib/client-api'

const ROUTE_MIN_MS = 520
const ROUTE_MAX_MS = 3500
const API_DELAY_MS = 420

export default function GlobalRoomieLoader() {
  const { activePage, loading, authTransition } = useApp()
  const [routeVisible, setRouteVisible] = useState(false)
  const [apiVisible, setApiVisible] = useState(false)
  const [label, setLabel] = useState('Cambio stanza')
  const previousPageRef = useRef(activePage)
  const initializedRef = useRef(false)
  const routeStartRef = useRef(0)
  const routeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const apiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      routeTimersRef.current.forEach(clearTimeout)
      if (apiTimerRef.current) clearTimeout(apiTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (loading || authTransition) return
    if (!initializedRef.current) {
      initializedRef.current = true
      previousPageRef.current = activePage
      return
    }
    if (previousPageRef.current === activePage) return
    previousPageRef.current = activePage

    routeTimersRef.current.forEach(clearTimeout)
    routeTimersRef.current = []
    routeStartRef.current = Date.now()
    setLabel(activePage === 'home' ? 'Torniamo alla home' : 'Apriamo la sezione')
    setRouteVisible(true)

    const minTimer = setTimeout(() => setRouteVisible(false), ROUTE_MIN_MS)
    const maxTimer = setTimeout(() => setRouteVisible(false), ROUTE_MAX_MS)
    routeTimersRef.current = [minTimer, maxTimer]
  }, [activePage, authTransition, loading])

  useEffect(() => {
    return subscribeApiPending(pending => {
      if (pending > 0) {
        if (apiTimerRef.current) clearTimeout(apiTimerRef.current)
        apiTimerRef.current = setTimeout(() => {
          setApiVisible(true)
        }, API_DELAY_MS)
        return
      }

      if (apiTimerRef.current) {
        clearTimeout(apiTimerRef.current)
        apiTimerRef.current = null
      }
      setApiVisible(false)
    })
  }, [])

  if (loading || authTransition) return null

  return (
    <>
      {routeVisible && (
        <div className="global-route-loader" role="status" aria-live="polite">
          <div className="global-route-loader-card">
            <div className="roomie-loader-brand"><RoomieLogoText size="lg" /></div>
            <span className="roomie-chip roomie-chip-loader" aria-hidden="true"></span>
            <div className="boot-status-dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="global-route-loader-copy">{label}</div>
          </div>
        </div>
      )}
      {apiVisible && !routeVisible && (
        <div className="global-data-loader" role="status" aria-live="polite">
          <span className="global-data-loader-dot" aria-hidden="true"></span>
          <span>Carichiamo i dati</span>
        </div>
      )}
    </>
  )
}
