"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth"
import { StorefrontRulesResult, emptyStorefrontRules } from "./types"

interface CartItemContext {
  productId: string
  categoryId?: string
  quantity: number
  unitPrice: number
}

export interface UseStorefrontRulesOptions {
  /** Payment method code (e.g. "COD", "CREDIT_CARD") — enables PAYMENT_METHOD_DISCOUNT evaluation */
  paymentMethod?: string
  /** Shipping region — enables SHIPPING_RULE and TAX_RULE evaluation */
  shippingRegion?: string
}

/**
 * Hook that evaluates dynamic rules for the storefront.
 * Given a list of products (as cart items), calls POST /rules/evaluate
 * and returns all rule evaluation results.
 *
 * Only evaluates for authenticated users (rules are role-based).
 * Unauthenticated users get empty rules (everything visible).
 *
 * IMPORTANT: Pass a stable reference for `products` (useMemo in the parent)
 * to avoid infinite re-renders.
 */
export function useStorefrontRules(
  products: { id: string; categoryId?: string; unitPrice: number }[],
  quantity: number = 1,
  options?: UseStorefrontRulesOptions
): StorefrontRulesResult {
  const { user, loading: authLoading } = useAuth()
  const [result, setResult] = useState<StorefrontRulesResult>(emptyStorefrontRules())
  const [loading, setLoading] = useState(false)

  // Create a stable string key from product IDs for the useEffect dependency
  const productsKey = products.map((p) => p.id).join(",")
  const optionsKey = `${options?.paymentMethod ?? ""}|${options?.shippingRegion ?? ""}`

  useEffect(() => {
    if (authLoading || !user || products.length === 0) {
      setResult(emptyStorefrontRules())
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const cartItems: CartItemContext[] = products.map((p) => ({
      productId: p.id,
      categoryId: p.categoryId,
      quantity,
      unitPrice: p.unitPrice,
    }))

    const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

    fetch("/api/rules/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        cartItems,
        subtotal,
        paymentMethod: options?.paymentMethod,
        shippingRegion: options?.shippingRegion,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          console.error(`[useStorefrontRules] POST /rules/evaluate failed: ${res.status} ${res.statusText}`)
          throw new Error(`Failed to evaluate rules: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const r = data.result || data
        setResult({
          hiddenProductIds: new Set(r.hiddenProducts || []),
          hiddenPriceProductIds: new Set(r.hiddenPrices || []),
          nonPurchasableProducts: new Map(
            (r.nonPurchasable || []).map((np: any) => [np.productId, np.message || ""] as [string, string])
          ),
          productDiscounts: r.productDiscounts || [],
          cartDiscount: r.cartDiscount || null,
          paymentMethodDiscount: r.paymentMethodDiscount || null,
          bogo: r.bogo || [],
          shipping: r.shipping || null,
          availablePaymentMethods: r.availablePaymentMethods || [],
          minimumOrderQuantities: r.minimumOrderQuantities || [],
          maximumOrderQuantities: r.maximumOrderQuantities || [],
          taxes: r.taxes || [],
          checkoutRestrictions: r.checkoutRestrictions || [],
          quantityDiscounts: r.quantityDiscounts || [],
          extraCharges: r.extraCharges || [],
          loading: false,
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[useStorefrontRules] Error evaluating rules:", err)
        setResult(emptyStorefrontRules())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, productsKey, quantity, optionsKey])

  return { ...result, loading }
}