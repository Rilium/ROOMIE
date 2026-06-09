'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CartItem } from '@/app/context/AppContext'

const CART_STORAGE_KEY = 'roomie.cart.v1'
const CART_TTL_MS = 1000 * 60 * 60 * 4

export function useCartState() {
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.name === item.name)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + (item.qty || 1) }
        return next
      }
      return [...prev, { ...item, qty: item.qty || 1 }]
    })
  }, [])

  const updateCartItem = useCallback((name: string, delta: number) => {
    setCart(prev => prev.flatMap(item => {
      if (item.name !== name) return [item]
      const qty = Math.max(0, item.qty + delta)
      return qty > 0 ? [{ ...item, qty }] : []
    }))
  }, [])

  const removeCartItem = useCallback((name: string) => {
    setCart(prev => prev.filter(item => item.name !== name))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { expiresAt?: number; items?: CartItem[] }
      if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
        localStorage.removeItem(CART_STORAGE_KEY)
        return
      }
      if (Array.isArray(parsed.items)) setCart(parsed.items)
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    try {
      if (!cart.length) {
        localStorage.removeItem(CART_STORAGE_KEY)
        return
      }
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        expiresAt: Date.now() + CART_TTL_MS,
        items: cart,
      }))
    } catch {
      // localStorage is best-effort only.
    }
  }, [cart])

  return { cart, setCart, addToCart, updateCartItem, removeCartItem, clearCart }
}
