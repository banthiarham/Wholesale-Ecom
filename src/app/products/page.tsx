"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal, X, GitCompare, Heart, Flame, Minus, Plus } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { SeasonalDiscount, PaymentOffer, fetchSeasonalDiscounts, fetchPaymentOffers, getProductDiscount, discountBadge, getPaymentOfferBadge } from "@/lib/pricing"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"

interface Product {
  id: string
  title: string
  handle: string
  sku: string | null
  thumbnail: string | null
  unitPrice: number
  compareAtPrice: number | null
  moq: number
  inventoryQuantity: number
  rating: number
  vendorName: string | null
  tags: string[]
  tierPrices: { minQty: number; maxQty: number | null; price: number }[]
  categoryId?: string
  category?: { id: string; name: string; handle: string }
}

interface Category {
  id: string
  name: string
  handle: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)
  const [cartQtys, setCartQtys] = useState<Record<string, number>>({})
  const [filters, setFilters] = useState({ category: "", minPrice: "", maxPrice: "", inStock: false })
  const [showFilters, setShowFilters] = useState(false)
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [paymentOffers, setPaymentOffers] = useState<PaymentOffer[]>([])
  const { t } = useTranslation()
  const { user } = useAuth()

  // Evaluate dynamic rules for storefront visibility, pricing, and purchasability
  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId || p.category?.id, unitPrice: p.unitPrice })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts, extraCharges, shipping, loading: rulesLoading } = useStorefrontRules(rulesProducts)

  // Build a map of productId → rule discount for quick lookup
  const ruleDiscountMap = useMemo(() => {
    const m = new Map<string, { discountPercent: number; discountAmount: number; ruleName: string }>()
    for (const d of productDiscounts) m.set(d.productId, d)
    return m
  }, [productDiscounts])

  // Build BOGO map: buyProductId → offers
  const bogoMap = useMemo(() => {
    const m = new Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>()
    for (const b of bogo) {
      const arr = m.get(b.buyProductId) || []
      arr.push(b)
      m.set(b.buyProductId, arr)
    }
    return m
  }, [bogo])

  // Build quantity discount map
  const qtyDiscountMap = useMemo(() => {
    const m = new Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>()
    for (const qd of quantityDiscounts) {
      if (qd.productId) m.set(qd.productId, qd)
    }
    return m
  }, [quantityDiscounts])

  // Fetch role-based pricing for authenticated users
  const rolePricingProducts = useMemo(() => products.map((p) => ({ id: p.id, unitPrice: p.unitPrice })), [products])
  const { pricing: rolePricingMap } = useRolePricing(rolePricingProducts)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      fetch("/api/wishlist", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => { setWishlistIds(new Set((data.items || []).map((i: any) => i.productId))) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const cats: Category[] = []
        const flatten = (arr: any[]) => {
          for (const c of arr || []) {
            cats.push({ id: c.id, name: c.name, handle: c.handle })
            flatten(c.children)
          }
        }
        flatten(data.categories || [])
        setCategories(cats)
      })
    fetchSeasonalDiscounts().then(setDiscounts)
    fetchPaymentOffers().then(setPaymentOffers)
    loadProducts()
  }, [])

  const loadProducts = (overrideFilters?: any) => {
    setLoading(true)
    const f = overrideFilters || filters
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (f.category) params.set("category", f.category)
    if (f.minPrice) params.set("min_price", f.minPrice)
    if (f.maxPrice) params.set("max_price", f.maxPrice)
    if (f.inStock) params.set("in_stock", "true")

    fetch(`/api/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || [])
        setLoading(false)
      })
  }

  const handleAddToCart = async (productId: string, qty: number) => {
    setAddingId(productId)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      await fetch("/api/cart", {
        method: "POST",
        headers,
        body: JSON.stringify({ productId, quantity: qty }),
      })
      window.dispatchEvent(new CustomEvent("cart-updated"))
      setCartQtys((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + qty }))
    } catch (err) {
      console.error(err)
    } finally {
      setAddingId(null)
    }
  }

  const updateCartQty = async (productId: string, newQty: number, moq: number) => {
    if (newQty < moq) {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
        if (token) headers["Authorization"] = `Bearer ${token}`
        await fetch("/api/cart", {
          method: "POST",
          headers,
          body: JSON.stringify({ productId, quantity: 0 }),
        })
        window.dispatchEvent(new CustomEvent("cart-updated"))
      } catch { /* ignore */ }
      setCartQtys((prev) => { const next = { ...prev }; delete next[productId]; return next })
      return
    }
    setAddingId(productId)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      await fetch("/api/cart", {
        method: "POST",
        headers,
        body: JSON.stringify({ productId, quantity: newQty }),
      })
      window.dispatchEvent(new CustomEvent("cart-updated"))
      setCartQtys((prev) => ({ ...prev, [productId]: newQty }))
    } catch (err) {
      console.error(err)
    } finally {
      setAddingId(null)
    }
  }

  const toggleWishlist = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const token = localStorage.getItem("token")
    if (!token) { alert("Please sign in to add items to your wishlist"); return }
    try {
      if (wishlistIds.has(productId)) {
        const res = await fetch(`/api/wishlist/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) setWishlistIds((prev) => { const n = new Set(prev); n.delete(productId); return n })
      } else {
        const res = await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ productId }) })
        if (res.ok) setWishlistIds((prev) => new Set(prev).add(productId))
      }
    } catch (err) { console.error(err) }
  }

  const addToCompare = (e: React.MouseEvent, productId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const stored = localStorage.getItem("compareItems")
    const items: string[] = stored ? JSON.parse(stored) : []
    if (items.includes(productId)) return
    if (items.length >= 4) { alert("Max 4 products to compare"); return }
    items.push(productId)
    localStorage.setItem("compareItems", JSON.stringify(items))
  }

  const hasActiveFilters = filters.category || filters.minPrice || filters.maxPrice || filters.inStock

  return (
    <div className="min-h-screen bg-gray-50">
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t("nav.categories")}</h3>
              <button onClick={() => setShowFilters(false)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("nav.categories")}</label>
                <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">All</option>
                  {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Min Price</label>
                <input type="number" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max Price</label>
                <input type="number" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="999999" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.inStock} onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">In Stock Only</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { loadProducts(); setShowFilters(false); }} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Apply</button>
              {hasActiveFilters && (
                <button onClick={() => { const r = { category: "", minPrice: "", maxPrice: "", inStock: false }; setFilters(r); loadProducts(r); }} className="px-4 py-2 text-gray-600">Clear</button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t("products.title")}</h1>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder={t("products.search")} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadProducts()} className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-48" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border ${hasActiveFilters ? "border-primary-600 text-primary-600" : "border-gray-200 text-gray-600"}`}>
              <SlidersHorizontal size={18} />
            </button>
            <Link href="/compare" className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-primary-600 hover:border-primary-600 transition relative">
              <GitCompare size={18} />
              {typeof window !== "undefined" && JSON.parse(localStorage.getItem("compareItems") || "[]").length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[10px] rounded-full flex items-center justify-center">{JSON.parse(localStorage.getItem("compareItems") || "[]").length}</span>
              )}
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No products found.</p>
            {hasActiveFilters && <button onClick={() => { const r = { category: "", minPrice: "", maxPrice: "", inStock: false }; setFilters(r); loadProducts(r); }} className="mt-4 text-primary-600">Clear filters</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products
              .filter((p) => !hiddenProductIds.has(p.id))
              .map((product) => {
                const isPriceHidden = hiddenPriceProductIds.has(product.id)
                const isNonPurchasable = nonPurchasableProducts.has(product.id)
                const nonPurchasableMsg = nonPurchasableProducts.get(product.id) || ""
                const rp = rolePricingMap[product.id]
                const ruleDisc = ruleDiscountMap.get(product.id)
                const productBogo = bogoMap.get(product.id)
                const productQtyDisc = qtyDiscountMap.get(product.id)

                return (
              <div key={product.id} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition group">
                <Link href={`/products/${product.handle}`}>
                  <div className="h-48 bg-gray-100 relative overflow-hidden">
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                    {product.tags?.includes('best-seller') && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">Best Seller</span>
                    )}
                    {(() => {
                      const disc = getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)
                      if (disc) return <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><Flame size={10} />{discountBadge(disc)}</span>
                      return null
                    })()}
                    {(() => {
                      const offer = paymentOffers.find(o => o.productId === product.id || (product.categoryId && o.categoryId === product.categoryId) || (product.category?.id && o.categoryId === product.category.id) || (!o.productId && !o.categoryId))
                      if (offer) return <span className={`absolute bottom-2 left-2 ${offer.offerType === 'BANK' ? 'bg-blue-600' : 'bg-purple-600'} text-white text-xs font-bold px-2 py-1 rounded`}>{getPaymentOfferBadge(offer)}</span>
                      return null
                    })()}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => toggleWishlist(e, product.id)} className={`p-1.5 rounded-full shadow-sm ${wishlistIds.has(product.id) ? "bg-red-50 text-red-500" : "bg-white/90 text-gray-500 hover:text-red-500"}`}>
                        <Heart size={14} fill={wishlistIds.has(product.id) ? "currentColor" : "none"} />
                      </button>
                      <button onClick={(e) => addToCompare(e, product.id)} className="p-1.5 rounded-full bg-white/90 text-gray-500 hover:text-primary-600 shadow-sm">
                        <GitCompare size={14} />
                      </button>
                    </div>
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/products/${product.handle}`}>
                    <h3 className="font-semibold text-gray-900 truncate hover:text-primary-600">{product.title}</h3>
                  </Link>
                  {product.sku && <p className="text-xs text-gray-500 mt-1">{t("product.sku")}: {product.sku}</p>}
                  <p className="text-xs text-gray-500">{t("product.moq")}: {product.moq}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {isPriceHidden ? (
                      <span className="text-sm text-gray-500 italic">Login for pricing</span>
                    ) : rp ? (
                      <>
                        <span className="font-bold text-primary-700">{formatPrice(rp.rolePrice)}</span>
                        <span className="text-sm text-gray-400 line-through">{formatPrice(Number(product.unitPrice))}</span>
                        <span className="text-xs text-green-600 font-semibold">Save {rp.savingsPercent}%</span>
                      </>
                    ) : ruleDisc ? (
                      <>
                        <span className="font-bold text-primary-700">{formatPrice(Number(product.unitPrice) - ruleDisc.discountAmount)}</span>
                        <span className="text-sm text-gray-400 line-through">{formatPrice(Number(product.unitPrice))}</span>
                        <span className="text-xs text-green-600 font-semibold">{ruleDisc.discountPercent}% off</span>
                      </>
                    ) : product.tierPrices && product.tierPrices.length > 0 ? (
                      <>
                        <span className="text-xs text-green-600 font-semibold">From </span>
                        <span className="font-bold text-primary-700">{formatPrice(Number(product.tierPrices[product.tierPrices.length - 1].price))}</span>
                        <span className="text-sm text-gray-400 line-through">{formatPrice(Number(product.unitPrice))}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-primary-700">{formatPrice(Number(product.unitPrice))}</span>
                        {product.compareAtPrice && <span className="text-sm text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {ruleDisc && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        {ruleDisc.ruleName}
                      </span>
                    )}
                    <ProductRuleBadge
                      priceHidden={isPriceHidden}
                      nonPurchasable={isNonPurchasable}
                      nonPurchasableMessage={nonPurchasableMsg}
                      hasRolePrice={!!rp}
                      roleLabel={rp?.appliedRoleName || undefined}
                      bogoLabel={productBogo ? `Buy ${productBogo[0].buyQuantity} Get ${productBogo[0].freeQuantity} Free` : undefined}
                      quantityDiscountLabel={productQtyDisc ? productQtyDisc.ruleName : undefined}
                      discountLabel={ruleDisc?.ruleName}
                      discountPercent={ruleDisc?.discountPercent}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-yellow-500 text-sm">{"★".repeat(Math.round(product.rating))}</span>
                    <span className="text-xs text-gray-500">({product.rating})</span>
                  </div>
                  {cartQtys[product.id] ? (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => updateCartQty(product.id, cartQtys[product.id] - product.moq, product.moq)}
                        disabled={addingId === product.id}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="flex-1 text-center font-bold text-gray-900 tabular-nums">{cartQtys[product.id]}</span>
                      <button
                        onClick={() => updateCartQty(product.id, cartQtys[product.id] + product.moq, product.moq)}
                        disabled={addingId === product.id}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product.id, product.moq)}
                      disabled={addingId === product.id || product.inventoryQuantity <= 0 || isNonPurchasable}
                      className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isNonPurchasable ? (nonPurchasableMsg || "Not Available") : addingId === product.id ? "Adding..." : product.inventoryQuantity <= 0 ? t("product.outOfStock") : t("product.addToCart")}
                    </button>
                  )}
                </div>
              </div>
            )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
