'use client'

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { PublicUser } from '@/lib/types'
import type { LegalDocType, ToastPayload } from '@/app/context/AppContext'

interface LegacyBridgeOptions {
  navigateToPage: (page: string) => void
  showToast: (msg: string | ToastPayload) => void
  openLegalDoc: (type: LegalDocType) => void
  openModalNfc: () => void
  openModalCodeUnlock: () => void
  openModalInvite: () => void
  openModalTokenBuy: (amount: number) => void
  userRef: MutableRefObject<PublicUser | null>
}

export function useLegacyRoomieBridge({
  navigateToPage,
  showToast,
  openLegalDoc,
  openModalNfc,
  openModalCodeUnlock,
  openModalInvite,
  openModalTokenBuy,
  userRef,
}: LegacyBridgeOptions) {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__roomie_showPage = navigateToPage
    w.__roomie_showToast = showToast
    w.__roomie_openLegalDoc = openLegalDoc
    w.__roomie_getUser = () => userRef.current
    w.openLegalDoc = (type: string) => openLegalDoc(type as LegalDocType)
    w.openNfcModal = openModalNfc
    w.openCodeUnlockModal = openModalCodeUnlock
    w.openInviteModal = openModalInvite
    w.openTokenBuyModal = (amount?: number) => openModalTokenBuy(amount ?? 20)

    return () => {
      ;[
        '__roomie_showPage',
        '__roomie_showToast',
        '__roomie_openLegalDoc',
        '__roomie_getUser',
        'openLegalDoc',
        'openNfcModal',
        'openCodeUnlockModal',
        'openInviteModal',
        'openTokenBuyModal',
      ].forEach(key => { w[key] = undefined })
    }
  }, [
    navigateToPage,
    showToast,
    openLegalDoc,
    openModalNfc,
    openModalCodeUnlock,
    openModalInvite,
    openModalTokenBuy,
    userRef,
  ])
}
