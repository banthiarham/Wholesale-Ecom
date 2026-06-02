"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ShoppingCart, Star, Gift, Layers, ArrowRight } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useStorefrontRules } from "@/lib/rules"
import { useAuth } from "@/lib/auth"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount, discountBadge } from "@/lib/pricing"

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
  categoryId?: string
  category?: { id: string; name: string; handle: string }
  vendorName?: string
  tags?: string[]
  tierPrices: { minQty: number; maxQty: number | null; price: string }[]
  _count?: { reviews: number }
}

interface TopSellingSectionProps {
  sectionId: string
  title: string
  categoryId: string
  categoryHandle?: string
  limit?: number
  productIds?: string[]
}

export default function TopSellingSection({ sectionId, title, categoryId, categoryHandle, limit = 8, productIds }: TopSellingSectionProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const { user } = useAuth()

  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId || p.category?.id, unitPrice: Number(p.unitPrice) })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts } = useStorefrontRules(rulesProducts)
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
    if (productIds && productIds.length > 0) {
      // Fetch specific products by IDs (curated selection)
      fetch(`/api/products?ids=${productIds.join(",")}&limit=${productIds.length}`)
        .then((res) => res.json())
        .then((data) => setProducts(data.products || []))
        .catch(() => {})
    } else if (categoryId) {
      // Auto-fetch top selling products by category
      fetch(`/api/products?category=${categoryId}&sort=popularity&limit=${limit}`)
        .then((res) => res.json())
        .then((data) => setProducts(data.products || []))
        .catch(() => {})
    }
    fetchSeasonalDiscounts().then(setDiscounts)
  }, [categoryId, limit, productIds])

  const handleAddToCart = async (productId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId, quantity: 1 }) })
    window.dispatchEvent(new CustomEvent("cart-updated"))
  }

  const visibleProducts = products.filter((p) => !hiddenProductIds.has(p.id))

  if (visibleProducts.length === 0) return null

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
          {categoryHandle && (
            <Link href={`/categories/${categoryHandle}`} className="flex items-center gap-1 text-primary-600 font-medium hover:gap-2 transition-all text-sm">
              View All <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {visibleProducts.map((product) => {
            const isPriceHidden = hiddenPriceProductIds.has(product.id)
            const isNonPurchasable = nonPurchasableProducts.has(product.id)
            const rp = rolePricingMap[product.id]
            const ruleDisc = ruleDiscountMap.get(product.id)
            const productBogo = bogoMap.get(product.id)
            const productQtyDisc = qtyDiscountMap.get(product.id)
            const disc = getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)

            return (
              <div key={product.id} className="min-w-[200px] sm:min-w-[220px] lg:min-w-[240px] bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition group flex-shrink-0">
                <Link href={`/products/${product.handle}`}>
                  <div className="relative h-40 bg-gray-100">
                    {product.thumbnail || product.images?.[0] ? (
                      <img src={product.thumbnail || product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📦</div>
                    )}
                    {disc && <span className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-semibold rounded">{discountBadge(disc)}</span>}
                    {product.tierPrices?.length > 0 && <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">Bulk</span>}
                  </div>
                </Link>
                <div className="p-3">
                  <Link href={`/products/${product.handle}`}>
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-1 group-hover:text-primary-600 transition">{product.title}</h3>
                  </Link>
                  <div className="flex items-center gap-1 mt-1">
                    {product.rating > 0 && <><Star size={12} className="text-amber-400 fill-amber-400" /><span className="text-xs text-gray-500">{product.rating}</span></>}
                  </div>
                  <div className="mt-1">
                    {isPriceHidden ? (
                      <span className="text-sm text-gray-500 italic">Login for pricing</span>
                    ) : rp ? (
                      <div>
                        <span className="font-bold text-primary-700">{formatPrice(rp.rolePrice)}</span>
                        <span className="text-xs text-gray-400 line-through ml-1">{formatPrice(product.unitPrice)}</span>
                      </div>
                    ) : ruleDisc ? (
                      <div>
                        <span className="font-bold text-primary-700">{formatPrice(Number(product.unitPrice) - ruleDisc.discountAmount)}</span>
                        <span className="text-xs text-gray-400 line-through ml-1">{formatPrice(product.unitPrice)}</span>
                      </div>
                    ) : product.tierPrices?.length > 0 ? (
                      <div>
                        <span className="text-xs text-green-600 font-semibold">From </span>
                        <span className="font-bold text-gray-900">{formatPrice(Number(product.tierPrices[product.tierPrices.length - 1].price))}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-gray-900">{formatPrice(product.unitPrice)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <ProductRuleBadge
                      priceHidden={isPriceHidden}
                      nonPurchasable={isNonPurchasable}
                      hasRolePrice={!!rp}
                      roleLabel={rp?.appliedRoleName || undefined}
                      bogoLabel={productBogo ? `Buy ${productBogo[0].buyQuantity} Get ${productBogo[0].freeQuantity} Free` : undefined}
                      quantityDiscountLabel={productQtyDisc ? productQtyDisc.ruleName : undefined}
                      discountLabel={ruleDisc?.ruleName}
                      discountPercent={ruleDisc?.discountPercent}
                      size="sm"
                    />
                  </div>
                  {!isNonPurchasable && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleAddToCart(product.id) }}
                      className="mt-2 w-full py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}