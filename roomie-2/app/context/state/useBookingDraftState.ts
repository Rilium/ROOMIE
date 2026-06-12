'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ActiveSession, BookingDraft, InvitedFriend } from '@/app/context/AppContext'

const BOOKING_DRAFT_STORAGE_KEY = 'roomie.bookingDraft.v1'

function readStoredDraft(defaultBooking: BookingDraft): { booking: BookingDraft; invitedFriends: InvitedFriend[] } {
  if (typeof window === 'undefined') return { booking: defaultBooking, invitedFriends: [] }
  try {
    const raw = localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)
    if (!raw) return { booking: defaultBooking, invitedFriends: [] }
    const parsed = JSON.parse(raw) as { booking?: Partial<BookingDraft>; invitedFriends?: InvitedFriend[] }
    return {
      booking: { ...defaultBooking, ...(parsed.booking || {}) },
      invitedFriends: Array.isArray(parsed.invitedFriends) ? parsed.invitedFriends.slice(0, 7) : [],
    }
  } catch {
    localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY)
    return { booking: defaultBooking, invitedFriends: [] }
  }
}

export function useBookingDraftState(
  defaultBooking: BookingDraft,
  setActiveSessionState: Dispatch<SetStateAction<ActiveSession | null>>,
) {
  const [booking, setBookingState] = useState<BookingDraft>(defaultBooking)
  const [invitedFriends, setInvitedFriends] = useState<InvitedFriend[]>([])
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    const stored = readStoredDraft(defaultBooking)
    setBookingState(stored.booking)
    setInvitedFriends(stored.invitedFriends)
    setStorageReady(true)
  }, [defaultBooking])

  useEffect(() => {
    if (!storageReady) return
    try {
      localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify({ booking, invitedFriends }))
    } catch {
      // localStorage is best-effort only.
    }
  }, [booking, invitedFriends, storageReady])

  const setBookingDraft = useCallback((updates: Partial<BookingDraft>) => {
    setBookingState(prev => ({ ...prev, ...updates }))
  }, [])

  const addInvitedFriends = useCallback((friends: InvitedFriend[]) => {
    setInvitedFriends(prev => {
      const byId = new Map(prev.map(friend => [friend.id, friend]))
      friends.forEach(friend => byId.set(friend.id, friend))
      const next = Array.from(byId.values()).slice(0, 7)
      setBookingState(current => ({ ...current, friends: next.map(friend => friend.id) }))
      return next
    })
    setActiveSessionState(current => {
      if (!current) return current
      const byId = new Map((current.friends ?? []).map(friend => [friend.id, friend]))
      friends.forEach(friend => byId.set(friend.id, friend))
      return { ...current, friends: Array.from(byId.values()).slice(0, 7) }
    })
  }, [setActiveSessionState])

  const removeInvitedFriend = useCallback((id: string) => {
    setInvitedFriends(prev => {
      const next = prev.filter(friend => friend.id !== id)
      setBookingState(current => ({ ...current, friends: next.map(friend => friend.id) }))
      return next
    })
    setActiveSessionState(current => current ? {
      ...current,
      friends: (current.friends ?? []).filter(friend => friend.id !== id),
    } : current)
  }, [setActiveSessionState])

  const clearBookingDraft = useCallback(() => {
    setBookingState(defaultBooking)
    setInvitedFriends([])
    try {
      localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY)
    } catch {}
  }, [defaultBooking])

  return {
    booking,
    invitedFriends,
    setBookingDraft,
    addInvitedFriends,
    removeInvitedFriend,
    clearBookingDraft,
  }
}
