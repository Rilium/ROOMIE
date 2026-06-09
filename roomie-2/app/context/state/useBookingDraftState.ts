'use client'

import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ActiveSession, BookingDraft, InvitedFriend } from '@/app/context/AppContext'

export function useBookingDraftState(
  defaultBooking: BookingDraft,
  setActiveSessionState: Dispatch<SetStateAction<ActiveSession | null>>,
) {
  const [booking, setBookingState] = useState<BookingDraft>(defaultBooking)
  const [invitedFriends, setInvitedFriends] = useState<InvitedFriend[]>([])

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
