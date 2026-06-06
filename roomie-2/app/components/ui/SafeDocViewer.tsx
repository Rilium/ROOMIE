'use client'

import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'

const MAMMOTH_SRC = 'https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js'
let mammothLoadPromise: Promise<typeof window.mammoth | null> | null = null

declare global {
  interface Window {
    mammoth?: {
      convertToHtml: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }>
    }
  }
}

export interface SafeDocViewerProps {
  file: string
  fallback: string
  active?: boolean
  className?: string
  contentClassName?: string
  contentStyle?: React.CSSProperties
  loadingLabel?: string
  errorLabel?: string
  wrapHtml?: (html: string) => string
}

async function waitForMammoth(timeoutMs = 3000) {
  if (window.mammoth?.convertToHtml) return window.mammoth
  if (!mammothLoadPromise) {
    mammothLoadPromise = new Promise<typeof window.mammoth | null>(resolve => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${MAMMOTH_SRC}"]`)
      const script = existing ?? document.createElement('script')
      const startedAt = Date.now()

      const interval = window.setInterval(() => {
        if (window.mammoth?.convertToHtml) {
          window.clearInterval(interval)
          resolve(window.mammoth)
          return
        }
        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(interval)
          resolve(null)
        }
      }, 100)

      if (!existing) {
        script.src = MAMMOTH_SRC
        script.async = true
        script.onload = () => {
          window.clearInterval(interval)
          resolve(window.mammoth ?? null)
        }
        script.onerror = () => {
          window.clearInterval(interval)
          resolve(null)
        }
        document.head.appendChild(script)
      }
    })
  }
  return mammothLoadPromise
}

export default function SafeDocViewer({
  file,
  fallback,
  active = true,
  className,
  contentClassName,
  contentStyle,
  loadingLabel = 'Caricamento documento…',
  errorLabel = 'Nessun contenuto disponibile',
  wrapHtml,
}: SafeDocViewerProps) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!active) {
      setHtml('')
      setError(false)
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(false)
      try {
        const mammoth = await waitForMammoth()
        if (!mammoth?.convertToHtml) throw new Error('MAMMOTH_UNAVAILABLE')

        const response = await fetch(file)
        if (!response.ok) throw new Error('DOC_NOT_FOUND')

        const arrayBuffer = await response.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        const raw = wrapHtml ? wrapHtml(result.value || fallback) : (result.value || fallback)
        if (!cancelled) setHtml(DOMPurify.sanitize(raw))
      } catch (err) {
        console.error('[SafeDocViewer] failed to load document:', err)
        const raw = wrapHtml ? wrapHtml(fallback) : fallback
        if (!cancelled) {
          setError(true)
          setHtml(DOMPurify.sanitize(raw))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [active, fallback, file, wrapHtml])

  if (loading) {
    return (
      <div className={className} style={contentStyle}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
          {loadingLabel}
        </div>
      </div>
    )
  }

  return (
    <div className={className} style={contentStyle}>
      {html ? (
        <div className={contentClassName} dangerouslySetInnerHTML={{ __html: html }} style={{ wordBreak: 'break-word' }} />
      ) : (
        <div style={{ color: 'var(--muted)' }}>{error ? errorLabel : 'Nessun contenuto disponibile'}</div>
      )}
    </div>
  )
}
