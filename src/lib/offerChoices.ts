"use client"

import { useCallback, useEffect, useState } from "react"
import { getCartSessionId } from "@/lib/utils"

/**
 * Which offer a shopper picked for a product. One offer applies per product at a time:
 *   - no entry  -> the best offer whose condition is met applies automatically
 *   - a rule id -> that offer applies (once its condition is met)
 *   - "none"    -> no offer applies
 * Kept in localStorage so every page agrees, and mirrored onto the cart item server-side
 * (PUT /api/cart/offer) so cart totals and BOGO free items follow the same choice.
 */
const KEY = "offer_choices"
const EVENT = "offer-choices-changed"

type Choices = Record<string, string>

function read(): Choices {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function getOfferChoice(productId: string): string | undefined {
  return read()[productId]
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  if (token) headers["Authorization"] = "Bearer " + token
  return headers
}

/** Tell the server (no-op there if the product is not in the cart yet). */
export async function pushOfferChoice(productId: string, choice: string) {
  try {
    const res = await fetch("/api/cart/offer", { method: "PUT", headers: authHeaders(), body: JSON.stringify({ productId, choice }) })
    if (res.ok) window.dispatchEvent(new CustomEvent("cart-updated"))
  } catch {
    /* the local choice still drives the storefront */
  }
}

export function setOfferChoice(productId: string, choice: string | null) {
  const all = read()
  if (choice === null) delete all[productId]
  else all[productId] = choice
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  if (choice !== null) void pushOfferChoice(productId, choice)
}

/** Bumps whenever any product's choice changes (so callers can re-evaluate). */
export function useOfferChoicesVersion() {
  const [v, setV] = useState(0)
  useEffect(() => {
    const bump = () => setV((n) => n + 1)
    window.addEventListener(EVENT, bump)
    window.addEventListener("storage", bump)
    return () => {
      window.removeEventListener(EVENT, bump)
      window.removeEventListener("storage", bump)
    }
  }, [])
  return v
}

export function useOfferChoice(productId?: string | null): [string | undefined, (choice: string | null) => void] {
  const version = useOfferChoicesVersion()
  const choice = productId ? getOfferChoice(productId) : undefined
  const set = useCallback((c: string | null) => { if (productId) setOfferChoice(productId, c) }, [productId])
  // `version` is read so the component re-renders when the choice changes.
  void version
  return [choice, set]
}

/** Make the server cart match what the shopper picked on product pages. */
export async function syncOfferChoices(items: { productId: string; metadata?: any }[]) {
  const all = read()
  for (const it of items) {
    const local = all[it.productId]
    if (local && it.metadata?.offerChoice !== local && it.metadata?.bogo !== true) {
      await pushOfferChoice(it.productId, local)
    }
  }
}
