'use client'

import { useCallback, useRef, useState } from 'react'
import type { LegalDocType, ToastPayload } from '@/app/context/AppContext'

export function useUiState() {
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [modalNfc, setModalNfc] = useState(false)
  const [modalCodeUnlock, setModalCodeUnlock] = useState(false)
  const [modalTokenBuy, setModalTokenBuy] = useState<{ open: boolean; amount: number }>({ open: false, amount: 20 })
  const [modalLegalDoc, setModalLegalDoc] = useState<{ open: boolean; type: LegalDocType | null }>({ open: false, type: null })
  const [modalInvite, setModalInvite] = useState(false)

  const showToast = useCallback((msg: string | ToastPayload) => {
    const payload = typeof msg === 'string' ? { title: msg } : msg
    setToast(payload)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const openModalNfc = useCallback(() => setModalNfc(true), [])
  const openModalCodeUnlock = useCallback(() => setModalCodeUnlock(true), [])
  const openModalTokenBuy = useCallback((amount: number) => setModalTokenBuy({ open: true, amount }), [])
  const openLegalDoc = useCallback((type: LegalDocType) => setModalLegalDoc({ open: true, type }), [])
  const openModalInvite = useCallback(() => setModalInvite(true), [])
  const closeModal = useCallback((name: 'nfc' | 'codeUnlock' | 'tokenBuy' | 'legalDoc' | 'invite') => {
    if (name === 'nfc') setModalNfc(false)
    else if (name === 'codeUnlock') setModalCodeUnlock(false)
    else if (name === 'tokenBuy') setModalTokenBuy(p => ({ ...p, open: false }))
    else if (name === 'legalDoc') setModalLegalDoc(p => ({ ...p, open: false }))
    else if (name === 'invite') setModalInvite(false)
  }, [])

  return {
    toast,
    modalNfc,
    modalCodeUnlock,
    modalTokenBuy,
    modalLegalDoc,
    modalInvite,
    showToast,
    openModalNfc,
    openModalCodeUnlock,
    openModalTokenBuy,
    openLegalDoc,
    openModalInvite,
    closeModal,
  }
}
