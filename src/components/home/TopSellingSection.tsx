"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useStorefrontRules } from "@/lib/rules"
import { useAuth } from "@/lib/auth"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount } from "@/lib/pricing"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"
import { ProductCarousel } from "@/components/ui/ProductCarousel"

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
  const [addingId, setAddingId] = useState<string | null>(null)
  const { user } = useAuth()
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

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

  const handleAddToCart = async (productId: string, moq: number) => {
    setAddingId(productId)
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    try {
      const res = await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId, quantity: moq }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("cart-updated"))
        openCartDrawer()
      } else {
        showToast("error", data.message || "Could not add to cart")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setAddingId(null)
    }
  }

  const visibleProducts = products.filter((p) => !hiddenProductIds.has(p.id))

  if (visibleProducts.length === 0) return null

  return (
    <section className="section-padding-tight">
      <div className="section-container">
        {/* Small extra inset (on top of section-container's own padding) so the
            row never reads as edge-to-edge — lands at ~24-32px total per side. */}
        <div className="px-2">
          <div className="section-header">
            <div>
              <span className="eyebrow">Top Selling</span>
              <h2 className="heading-lg">{title}</h2>
              <p className="body-sm mt-1.5">Handpicked products at wholesale prices</p>
            </div>
            {categoryHandle && (
              <Link href={`/categories/${categoryHandle}`} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-all duration-200">
                View All <ArrowRight size={16} />
              </Link>
            )}
          </div>
          <ProductCarousel
            items={visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{ ...product, thumbnail: product.thumbnail || product.images?.[0] || null }}
                view="grid"
                isPriceHidden={hiddenPriceProductIds.has(product.id)}
                isNonPurchasable={nonPurchasableProducts.has(product.id)}
                rolePricing={rolePricingMap[product.id]}
                ruleDiscount={ruleDiscountMap.get(product.id)}
                bogo={bogoMap.get(product.id)}
                quantityDiscount={qtyDiscountMap.get(product.id)}
                seasonalDiscount={getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)}
                isAdding={addingId === product.id}
                onAddToCart={handleAddToCart}
              />
            ))}
          />
          <Link href={`/categories/${categoryHandle || ""}`} className="sm:hidden flex items-center justify-center gap-1.5 text-primary-600 font-semibold mt-5 text-sm">
            View All Products <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
