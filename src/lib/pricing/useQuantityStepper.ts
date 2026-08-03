"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { clampQuantity } from "../pricing"

/**
 * Single shared quantity-stepper state machine used by Product Details, Mini Cart,
 * and Cart — so "default = MOQ", "step by exactly 1", and "disable minus only at
 * MOQ" can never drift out of sync between pages.
 *
 * All mutations use functional setState updates (`setQty(prev => ...)`), never the
 * `qty` value captured in the calling render's closure. This matters: an onClick
 * handler written as `onClick={() => setQty(decrementQuantity(qty, ...))}` closes
 * over whatever `qty` was at render time. If two clicks land before React re-renders
 * between them (rapid clicks, or a fast double-tap), both computed "current - 1"
 * from the same stale `qty` — so two clicks only moved the value by one step, which
 * reads exactly like "the minus button does nothing". Reading from `prev` inside the
 * updater removes that class of bug entirely, no matter how fast the clicks arrive.
 *
 * @param resetKey    Changing this reseeds local quantity to `resetValue` (e.g. pass
 *                     `item.id + ':' + item.quantity` for a cart row so it re-syncs
 *                     after a server-confirmed update, or `product.id` for a fresh
 *                     product-page selector so it only reseeds when navigating to a
 *                     different product).
 * @param resetValue  The value to seed/reseed to (MOQ for a fresh selector, or the
 *                     server-confirmed `item.quantity` for an existing cart row). Also
 *                     used as the baseline `onCommit` compares against to skip no-op writes.
 * @param moq         Minimum order quantity — the floor.
 * @param maxQty      Upper bound (e.g. available inventory).
 * @param onCommit    Optional debounced callback fired when the clamped quantity
 *                     differs from `resetValue` (e.g. persist to the cart API). Omit
 *                     for a purely local selector (nothing to sync yet).
 * @param debounceMs  Debounce delay before `onCommit` fires. Default 400ms.
 */
export function useQuantityStepper(
  resetKey: string | number | null | undefined,
  resetValue: number,
  moq: number,
  maxQty: number,
  onCommit?: (quantity: number) => void,
  debounceMs: number = 400
) {
  const [qty, setQty] = useState(() => clampQuantity(resetValue, moq, maxQty))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const boundsRef = useRef({ moq, maxQty })
  boundsRef.current = { moq, maxQty }

  // Reseed local quantity from the authoritative source only when `resetKey` changes
  // (e.g. a different product, or the server confirmed a new quantity for this cart
  // row) — never on every render, so it can't fight the user's in-progress clicks.
  useEffect(() => {
    setQty(clampQuantity(resetValue, moq, maxQty))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const scheduleCommit = useCallback((next: number) => {
    if (!commitRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (next !== resetValue) commitRef.current!(next)
    }, debounceMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceMs, resetValue])

  const step = useCallback((delta: 1 | -1) => {
    setQty((prev) => {
      const { moq: m, maxQty: x } = boundsRef.current
      const next = clampQuantity(prev + delta, m, x)
      scheduleCommit(next)
      return next
    })
  }, [scheduleCommit])

  const increment = useCallback(() => step(1), [step])
  const decrement = useCallback(() => step(-1), [step])

  // Free typing: accept any numeric keystroke without clamping mid-type (guards NaN
  // only), then clamp + commit on blur/Enter via `flush`.
  const setTyped = useCallback((raw: number) => {
    if (!isNaN(raw)) setQty(raw)
  }, [])

  const flush = useCallback(() => {
    setQty((prev) => {
      const { moq: m, maxQty: x } = boundsRef.current
      const clamped = clampQuantity(prev, m, x)
      scheduleCommit(clamped)
      return clamped
    })
  }, [scheduleCommit])

  return {
    qty,
    increment,
    decrement,
    setTyped,
    flush,
    /** True once quantity has hit the floor — wire directly to the minus button's `disabled`. */
    atMin: qty <= moq,
  }
}
