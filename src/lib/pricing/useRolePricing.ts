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
}

type RolePricingMap = Record<string, RolePricingInfo>

/**
 * Hook that fetches role-based pricing for a list of products.
 * Only fetches for authenticated users.
 * Returns a map of productId → role pricing info.
 *
 * IMPORTANT: Pass a stable reference for `products` (use useMemo in the parent)
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

          console.log("[PricingEngine:useRolePricing]", {
            productId: p.id,
            loggedInRole: result.appliedRoleName,
            basePrice: result.basePrice,
            rolePrice: result.rolePrice,
            tierPrice: result.tierPrice,
            finalPrice: result.finalPrice,
            appliedRule: result.appliedRule,
          })

          // Role/contract custom price always wins — show it regardless of whether it's
          // higher or lower than the base/tier price (a custom price is not a "deal").
          if (result.appliedRule === "role" || result.appliedRule === "contract") {
            return {
              productId: p.id,
              info: {
                rolePrice: result.finalPrice,
                appliedRoleName: result.appliedRoleName,
                savings: result.basePrice - result.finalPrice,
                savingsPercent: result.discountPercent,
                finalPrice: result.finalPrice,
              } as RolePricingInfo,
            }
          }
          // Otherwise, if the final price is a genuine discount off base (tier/seasonal), include it
          if (result.finalPrice < result.basePrice) {
            return {
              productId: p.id,
              info: {
                rolePrice: result.finalPrice,
                appliedRoleName: result.appliedRoleName,
                savings: result.basePrice - result.finalPrice,
                savingsPercent: Math.round(((result.basePrice - result.finalPrice) / result.basePrice) * 100),
                finalPrice: result.finalPrice,
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