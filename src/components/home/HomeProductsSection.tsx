"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount } from "@/lib/pricing"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"

interface Product {
  id: string
  title: string
  handle: string
  unitPrice: string
  compareAtPrice: string | null
  moq: number
  thumbnail: string | null
  images: string[]
  rating: number
  reviewCount: number
  inventoryQuantity?: number
  sku?: string | null
  categoryId?: string
  category?: { id: string; name: string; handle: string }
  tags?: string[]
  tierPrices: { minQty: number; maxQty: number | null; price: string }[]
}

interface Props {
  title: string
  subtitle?: string
  /** Query string for /api/products, e.g. "sort=bestselling&limit=10" */
  query: string
  viewAllHref: string
  viewAllLabel?: string
  /** "tint" puts the section in a soft brand-coloured panel; "plain" is a white card. */
  tone?: "tint" | "plain"
}

/**
 * A titled block of product cards (5 per row, up to 2 rows on desktop) with a "view all"
 * button in the header. Every colour comes from the theme's `primary` palette, so changing the
 * primary colour in Admin → Settings recolours it.
 */
export default function HomeProductsSection({ title, subtitle, query, viewAllHref, viewAllLabel = "View all products", tone = "plain" }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loaded, setLoaded] = useState(false)
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId || p.category?.id, unitPrice: Number(p.unitPrice) })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts, customBadges } = useStorefrontRules(rulesProducts)
  const rolePricingProducts = useMemo(() => products.map((p) => ({ id: p.id, unitPrice: Number(p.unitPrice) })), [products])
  const { pricing: rolePricingMap } = useRolePricing(rolePricingProducts)

  const ruleDiscountMap = useMemo(() => {
    const m = new Map<string, { discountPercent: number; discountAmount: number; ruleName: string }>()
    for (const d of productDiscounts) m.set(d.productId, d)
    return m
  }, [productDiscounts])

  const bogoMap = useMemo(() => {
    const m = new Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>()
    for (const b of bogo) { const arr = m.get(b.buyProductId) || []; arr.push(b); m.set(b.buyProductId, arr) }
    return m
  }, [bogo])

  const qtyDiscountMap = useMemo(() => {
    const m = new Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>()
    for (const qd of quantityDiscounts) { if (qd.productId) m.set(qd.productId, qd) }
    return m
  }, [quantityDiscounts])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/products?${query}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setProducts(data.products || []) })
      .catch(() => { if (!cancelled) setProducts([]) })
      .finally(() => { if (!cancelled) setLoaded(true) })
    fetchSeasonalDiscounts().then((d) => { if (!cancelled) setDiscounts(d) })
    return () => { cancelled = true }
  }, [query])

  const handleAddToCart = async (productId: string, qty: number) => {
    setAddingId(productId)
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    try {
      const res = await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId, quantity: qty }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("cart-updated"))
        openCartDrawer()
      } else {
        showToast("error", data.message || "Could not add to cart")
      }
    } catch {
      showToast("error", "Something went wrong")
    } finally {
      setAddingId(null)
    }
  }

  const visible = products.filter((p) => !hiddenProductIds.has(p.id))
  if (loaded && visible.length === 0) return null

  const panel = tone === "tint"
    ? "bg-primary-50/50 border border-primary-100/70"
    : "bg-white border border-gray-100"

  return (
    <section className="py-3 lg:py-4">
      <div className="section-container">
        <div className={`rounded-3xl p-4 sm:p-6 ${panel}`}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <h2 className="heading-lg">{title}</h2>
              {subtitle && <p className="body-sm mt-1">{subtitle}</p>}
            </div>
            <Link
              href={viewAllHref}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-primary-200 bg-white text-sm font-semibold text-primary-700 hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-colors"
            >
              {viewAllLabel} <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {!loaded
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white border border-gray-100 h-72 animate-pulse" />
                ))
              : visible.slice(0, 10).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{ ...product, thumbnail: product.thumbnail || product.images?.[0] || null }}
                    view="grid"
                    showQuantity
                    isPriceHidden={hiddenPriceProductIds.has(product.id)}
                    isNonPurchasable={nonPurchasableProducts.has(product.id)}
                    rolePricing={rolePricingMap[product.id]}
                    ruleDiscount={ruleDiscountMap.get(product.id)}
                    bogo={bogoMap.get(product.id)}
                    quantityDiscount={qtyDiscountMap.get(product.id)}
                    customBadges={customBadges}
                    seasonalDiscount={getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)}
                    isAdding={addingId === product.id}
                    onAddToCart={handleAddToCart}
                  />
                ))}
          </div>
        </div>
      </div>
    </section>
  )
}
