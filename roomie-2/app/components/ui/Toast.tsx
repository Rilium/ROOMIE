'use client'

import { useApp } from '@/app/context/AppContext'

export default function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return (
    <div id="toast" className="toast-pop show">
      <div className="toast-icon">
        <i className={`fas ${toast.type === 'warn' ? 'fa-exclamation-triangle' : 'fa-check'}`}></i>
      </div>
      <div className="toast-body">
        <div className="toast-title">{toast.title}</div>
        {toast.copy && <div className="toast-copy">{toast.copy}</div>}
      </div>
    </div>
  )
}
