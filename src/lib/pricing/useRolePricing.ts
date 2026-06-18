"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { fetchPricing } from "@/lib/pricing"

interface RolePricingInfo {
  rolePrice: number
  appliedRoleName: string | null
  savings: number
  savingsPercent: number
  finalPrice: number
  bulkDiscountPercent: number | null
  bulkDiscountLabel: string | null
}

type RolePricingMap = Record<string, RolePricingInfo>

/**
 * Hook that fetches role-based pricing for a list of products.
 * Only fetches for authenticated users.
 * Returns a map of productId → role pricing info.
 *
 * IMPORTANT: Pass a stable reference for `products` (useMemo in the parent)
 * to avoid infinite re-renders.
 */
export function useRolePricing(
  products: { id: string; unitPrice: number }[],
  quantity: number = 1
): { pricing: RolePricingMap; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [pricingMap, setPricingMap] = useState<RolePricingMap>({})
  const [loading, setLoading] = useState(false)

  // Create a stable string key from product IDs for the useEffect dependency
  const productsKey = products.map((p) => p.id).join(",")

  useEffect(() => {
    if (authLoading || !user || products.length === 0) {
      setPricingMap({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    // Fetch pricing for each product in parallel
    const fetches = products.map((p) =>
      fetchPricing(p.id, quantity, user.id)
        .then((result) => {
          if (!result) return null
          // Per-product role price takes priority
          if (result.rolePrice && result.rolePrice < result.basePrice) {
            return {
              productId: p.id,
              info: {
                rolePrice: result.rolePrice,
                appliedRoleName: result.appliedRoleName,
                savings: result.basePrice - result.rolePrice,
                savingsPercent: result.discountPercent,
                finalPrice: result.finalPrice,
                bulkDiscountPercent: null,
                bulkDiscountLabel: null,
              } as RolePricingInfo,
            }
          }
          // Bulk role discount case
          if (result.bulkDiscountPercent && result.finalPrice < result.basePrice) {
            return {
              productId: p.id,
              info: {
                rolePrice: result.finalPrice,
                appliedRoleName: result.appliedRoleName,
                savings: result.basePrice - result.finalPrice,
                savingsPercent: Math.round(result.bulkDiscountPercent),
                finalPrice: result.finalPrice,
                bulkDiscountPercent: result.bulkDiscountPercent,
                bulkDiscountLabel: result.bulkDiscountLabel,
              } as RolePricingInfo,
            }
          }
          // Other discounts (seasonal, contract, etc.)
          if (result.finalPrice < result.basePrice) {
            return {
              productId: p.id,
              info: {
                rolePrice: result.finalPrice,
                appliedRoleName: result.appliedRoleName,
                savings: result.basePrice - result.finalPrice,
                savingsPercent: Math.round(((result.basePrice - result.finalPrice) / result.basePrice) * 100),
                finalPrice: result.finalPrice,
                bulkDiscountPercent: result.bulkDiscountPercent,
                bulkDiscountLabel: result.bulkDiscountLabel,
              } as RolePricingInfo,
            }
          }
          return null
        })
        .catch(() => null)
    )

    Promise.all(fetches).then((results) => {
      if (cancelled) return
      const map: RolePricingMap = {}
      for (const r of results) {
        if (r) map[r.productId] = r.info
      }
      setPricingMap(map)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, productsKey, quantity])

  return { pricing: pricingMap, loading }
}