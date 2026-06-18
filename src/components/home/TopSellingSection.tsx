"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ShoppingCart, Star, ArrowRight } from "lucide-react"
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
      fetch(`/api/products?ids=${productIds.join(",")}&limit=${productIds.length}`)
        .then((res) => res.json())
        .then((data) => setProducts(data.products || []))
        .catch((err) => { console.error("Failed to fetch top selling products:", err) })
    } else if (categoryId) {
      fetch(`/api/products?category=${categoryId}&sort=popularity&limit=${limit}`)
        .then((res) => res.json())
        .then((data) => setProducts(data.products || []))
        .catch((err) => { console.error("Failed to fetch top selling products:", err) })
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
    <section className="section-padding">
      <div className="section-container">
        <div className="section-header">
          <div>
            <h2 className="heading-lg">{title}</h2>
            <p className="body-sm mt-1">Handpicked products at wholesale prices</p>
          </div>
          {categoryHandle && (
            <Link href={`/categories/${categoryHandle}`} className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
              View All <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
          {visibleProducts.map((product) => {
            const isPriceHidden = hiddenPriceProductIds.has(product.id)
            const isNonPurchasable = nonPurchasableProducts.has(product.id)
            const rp = rolePricingMap[product.id]
            const ruleDisc = ruleDiscountMap.get(product.id)
            const productBogo = bogoMap.get(product.id)
            const productQtyDisc = qtyDiscountMap.get(product.id)
            const disc = getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)
            const comparePrice = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice)

            return (
              <div key={product.id} className="min-w-[220px] sm:min-w-[240px] lg:min-w-[260px] card-base overflow-hidden group snap-start flex-shrink-0">
                <Link href={`/products/${product.handle}`}>
                  <div className="relative aspect-square bg-gray-50 overflow-hidden">
                    {product.thumbnail || product.images?.[0] ? (
                      <img src={product.thumbnail || product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                        <ShoppingCart size={32} className="text-gray-200" />
                      </div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                      {disc && <span className="badge badge-warning">{discountBadge(disc)}</span>}
                      {product.tierPrices?.length > 0 && <span className="badge badge-success">Bulk</span>}
                    </div>
                    {/* Quick view overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/products/${product.handle}`}>
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug min-h-[2.5rem]">
                      {product.title}
                    </h3>
                  </Link>
                  {product.rating > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={11} className={s <= Math.round(product.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-400">({product.reviewCount})</span>
                    </div>
                  )}
                  <div className="mt-2">
                    {isPriceHidden ? (
                      <span className="text-xs text-gray-500 italic">Login for pricing</span>
                    ) : rp ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold text-primary-700">{formatPrice(rp.rolePrice)}</span>
                          <span className="text-xs text-gray-400 line-through">{formatPrice(product.unitPrice)}</span>
                        </div>
                        {rp.bulkDiscountLabel && (
                          <span className="text-[11px] text-purple-600 font-medium">{rp.bulkDiscountLabel}</span>
                        )}
                      </div>
                    ) : ruleDisc ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-primary-700">{formatPrice(Number(product.unitPrice) - ruleDisc.discountAmount)}</span>
                        <span className="text-xs text-gray-400 line-through">{formatPrice(product.unitPrice)}</span>
                      </div>
                    ) : product.tierPrices?.length > 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-green-600 font-semibold">From</span>
                        <span className="text-lg font-bold text-gray-900">{formatPrice(Number(product.tierPrices[product.tierPrices.length - 1].price))}</span>
                        {comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-gray-900">{formatPrice(product.unitPrice)}</span>
                        {comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
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
                      className="mt-3 w-full py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all duration-200 flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart size={13} /> Add to Cart
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <Link href={`/categories/${categoryHandle || ""}`} className="sm:hidden flex items-center justify-center gap-1.5 text-primary-600 font-semibold mt-4 text-sm">
          View All Products <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}