"use client"

import { useEffect, useState, useCallback } from "react"

interface TaxRate {
  taxRate: number
  productIds: string[]
  categoryIds: string[]
}

// One shared request per page load; every product card reads the same result.
let cache: TaxRate[] | null = null
let inflight: Promise<TaxRate[]> | null = null

function loadRates(): Promise<TaxRate[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch("/api/rules/tax-rates")
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((d) => (cache = Array.isArray(d.rules) ? d.rules : []))
      .catch(() => [] as TaxRate[])
      .finally(() => { inflight = null })
  }
  return inflight
}

/**
 * GST % to show on a product's listed price. Mirrors the checkout rule engine: every active
 * GST rule whose product/category scope matches contributes its rate (unscoped rules match all).
 */
export function useGstRates() {
  const [rates, setRates] = useState<TaxRate[]>(cache ?? [])

  useEffect(() => {
    let alive = true
    loadRates().then((r) => alive && setRates(r))
    return () => { alive = false }
  }, [])

  const rateFor = useCallback(
    (productId?: string | null, categoryId?: string | null): number =>
      rates.reduce((sum, r) => {
        const scoped = r.productIds.length > 0 || r.categoryIds.length > 0
        const match =
          !scoped ||
          (!!productId && r.productIds.includes(productId)) ||
          (!!categoryId && r.categoryIds.includes(categoryId))
        return match ? sum + r.taxRate : sum
      }, 0),
    [rates]
  )

  return { rateFor }
}

/** Amount with GST added, rounded to paise like the checkout does. */
export const withGst = (amount: number, ratePct: number) =>
  ratePct > 0 ? Math.round(amount * (1 + ratePct / 100) * 100) / 100 : amount

export const gstLabel = (ratePct: number) => `Incl. ${Number(ratePct.toFixed(2))}% GST`
