"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal, X, Heart, Flame, Grid3X3, List, ArrowUpDown, ChevronLeft, ChevronRight, Star } from "lucide-react"
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

type SortOption = "newest" | "price_asc" | "price_desc" | "rating" | "name"
type ViewMode = "grid" | "list"
const PRODUCTS_PER_PAGE = 12

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ category: "", minPrice: "", maxPrice: "", inStock: false })
  const [showFilters, setShowFilters] = useState(false)
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [paymentOffers, setPaymentOffers] = useState<PaymentOffer[]>([])
  const [sort, setSort] = useState<SortOption>("newest")
  const [view, setView] = useState<ViewMode>("grid")
  const [page, setPage] = useState(1)
  const { t } = useTranslation()
  const { user } = useAuth()

  // Evaluate dynamic rules
  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId || p.category?.id, unitPrice: p.unitPrice })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts } = useStorefrontRules(rulesProducts)

  const ruleDiscountMap = useMemo(() => {
    const m = new Map<string, { discountPercent: number; discountAmount: number; ruleName: string }>()
    for (const d of productDiscounts) m.set(d.productId, d)
    return m
  }, [productDiscounts])

  const bogoMap = useMemo(() => {
    const m = new Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>()
    for (const b of bogo) {
      const arr = m.get(b.buyProductId) || []
      arr.push(b)
      m.set(b.buyProductId, arr)
    }
    return m
  }, [bogo])

  const qtyDiscountMap = useMemo(() => {
    const m = new Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>()
    for (const qd of quantityDiscounts) {
      if (qd.productId) m.set(qd.productId, qd)
    }
    return m
  }, [quantityDiscounts])

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
        setPage(1)
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
      alert(t("products.addToCart"))
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

  const hasActiveFilters = filters.category || filters.minPrice || filters.maxPrice || filters.inStock

  // Sort & paginate visible products
  const visibleProducts = useMemo(() => {
    let filtered = products.filter((p) => !hiddenProductIds.has(p.id))
    switch (sort) {
      case "price_asc":
        filtered.sort((a, b) => a.unitPrice - b.unitPrice)
        break
      case "price_desc":
        filtered.sort((a, b) => b.unitPrice - a.unitPrice)
        break
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "name":
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
      default: // newest — keep original order
        break
    }
    return filtered
  }, [products, hiddenProductIds, sort])

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE))
  const paginatedProducts = visibleProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE)

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Filter sidebar */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="heading-sm">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="body-sm font-medium text-gray-700 mb-1.5 block">Category</label>
                <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="input-base">
                  <option value="">All Categories</option>
                  {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
              </div>
              <div>
                <label className="body-sm font-medium text-gray-700 mb-1.5 block">Min Price</label>
                <input type="number" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} className="input-base" placeholder="0" />
              </div>
              <div>
                <label className="body-sm font-medium text-gray-700 mb-1.5 block">Max Price</label>
                <input type="number" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} className="input-base" placeholder="999999" />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.inStock} onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="body-sm">In Stock Only</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { loadProducts(); setShowFilters(false); }} className="btn-primary">Apply Filters</button>
              {hasActiveFilters && (
                <button onClick={() => { const r = { category: "", minPrice: "", maxPrice: "", inStock: false }; setFilters(r); loadProducts(r); }} className="btn-outline">Clear All</button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="section-container py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="heading-lg">{t("products.title")}</h1>
            <p className="body-sm mt-1">{visibleProducts.length} products found</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={t("products.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadProducts()}
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            {/* Sort */}
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as SortOption); setPage(1) }}
                className="pl-8 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="rating">Top Rated</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
            {/* Filter toggle */}
            <button onClick={() => setShowFilters(!showFilters)} className={`p-2.5 rounded-xl border transition-all ${hasActiveFilters ? "border-primary-300 text-primary-600 bg-primary-50" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
              <SlidersHorizontal size={18} />
            </button>
            {/* View toggle */}
            <div className="hidden sm:flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setView("grid")} className={`p-2.5 transition-all ${view === "grid" ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-gray-600"}`}>
                <Grid3X3 size={18} />
              </button>
              <button onClick={() => setView("list")} className={`p-2.5 transition-all ${view === "list" ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-gray-600"}`}>
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : visibleProducts.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={28} className="text-gray-300" />
            </div>
            <h3 className="heading-sm text-gray-900 mb-2">No products found</h3>
            <p className="body-sm mb-6">Try adjusting your search or filter criteria</p>
            {hasActiveFilters && (
              <button onClick={() => { const r = { category: "", minPrice: "", maxPrice: "", inStock: false }; setFilters(r); loadProducts(r); }} className="btn-primary">
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Product grid / list */}
            {view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    view="grid"
                    isPriceHidden={hiddenPriceProductIds.has(product.id)}
                    isNonPurchasable={nonPurchasableProducts.has(product.id)}
                    nonPurchasableMsg={nonPurchasableProducts.get(product.id) || ""}
                    rp={rolePricingMap[product.id]}
                    ruleDisc={ruleDiscountMap.get(product.id)}
                    productBogo={bogoMap.get(product.id)}
                    productQtyDisc={qtyDiscountMap.get(product.id)}
                    disc={getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)}
                    paymentOffers={paymentOffers}
                    wishlistIds={wishlistIds}
                    addingId={addingId}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={toggleWishlist}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    view="list"
                    isPriceHidden={hiddenPriceProductIds.has(product.id)}
                    isNonPurchasable={nonPurchasableProducts.has(product.id)}
                    nonPurchasableMsg={nonPurchasableProducts.get(product.id) || ""}
                    rp={rolePricingMap[product.id]}
                    ruleDisc={ruleDiscountMap.get(product.id)}
                    productBogo={bogoMap.get(product.id)}
                    productQtyDisc={qtyDiscountMap.get(product.id)}
                    disc={getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)}
                    paymentOffers={paymentOffers}
                    wishlistIds={wishlistIds}
                    addingId={addingId}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={toggleWishlist}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${p === page ? "bg-primary-600 text-white" : "border border-gray-200 text-gray-600 hover:border-primary-300"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Product Card Component                                             */
/* ------------------------------------------------------------------ */

function ProductCard({
  product, view, isPriceHidden, isNonPurchasable, nonPurchasableMsg,
  rp, ruleDisc, productBogo, productQtyDisc, disc, paymentOffers,
  wishlistIds, addingId, onAddToCart, onToggleWishlist, t,
}: {
  product: Product
  view: "grid" | "list"
  isPriceHidden: boolean
  isNonPurchasable: boolean
  nonPurchasableMsg: string
  rp: any
  ruleDisc: { discountPercent: number; discountAmount: number; ruleName: string } | undefined
  productBogo: { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[] | undefined
  productQtyDisc: { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string } | undefined
  disc: SeasonalDiscount | undefined
  paymentOffers: PaymentOffer[]
  wishlistIds: Set<string>
  addingId: string | null
  onAddToCart: (id: string, qty: number) => void
  onToggleWishlist: (e: React.MouseEvent, id: string) => void
  t: (key: string) => string
}) {
  const comparePrice = !!(product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice))

  if (view === "list") {
    return (
      <Link href={`/products/${product.handle}`} className="card-base flex group">
        <div className="relative w-48 sm:w-56 flex-shrink-0 bg-gray-50 overflow-hidden">
          {product.thumbnail ? (
            <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full min-h-[160px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <Package2Icon size={32} className="text-gray-200" />
            </div>
          )}
          {disc && <span className="absolute top-2 left-2 badge badge-warning">{discountBadge(disc)}</span>}
          {product.tierPrices?.length > 0 && <span className="absolute top-2 right-2 badge badge-success">Bulk</span>}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => onToggleWishlist(e, product.id)} className={`p-1.5 rounded-lg shadow-sm ${wishlistIds.has(product.id) ? "bg-red-50 text-red-500" : "bg-white/90 text-gray-500 hover:text-red-500"}`}>
              <Heart size={14} fill={wishlistIds.has(product.id) ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
        <div className="flex-1 p-5 flex flex-col">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">{product.title}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            {product.rating > 0 && (
              <>
                <div className="flex">{[1, 2, 3, 4, 5].map((s) => (<Star key={s} size={12} className={s <= Math.round(product.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />))}</div>
                <span className="text-xs text-gray-400">({product.rating})</span>
              </>
            )}
            {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
          </div>
          <div className="mt-2">
            <PriceDisplay
              isPriceHidden={isPriceHidden}
              rp={rp}
              ruleDisc={ruleDisc}
              product={product}
              comparePrice={comparePrice}
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
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
          <div className="mt-auto pt-4 flex items-center gap-3">
            <span className="body-sm">MOQ: {product.moq}</span>
            {!isNonPurchasable && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(product.id, product.moq) }}
                disabled={addingId === product.id || product.inventoryQuantity <= 0}
                className="btn-primary text-sm py-2 px-5"
              >
                {addingId === product.id ? "Adding..." : product.inventoryQuantity <= 0 ? t("product.outOfStock") : t("product.addToCart")}
              </button>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // Grid view
  return (
    <Link href={`/products/${product.handle}`} className="card-base overflow-hidden group">
      <div className="relative aspect-square bg-gray-50">
        {product.thumbnail ? (
          <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package2Icon size={40} className="text-gray-200" />
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {disc && <span className="badge badge-warning">{discountBadge(disc)}</span>}
          {product.tierPrices?.length > 0 && <span className="badge badge-success">Bulk</span>}
          {product.tags?.includes("best-seller") && <span className="badge badge-primary">Best Seller</span>}
        </div>
        {comparePrice && <span className="absolute bottom-2.5 left-2.5 badge badge-danger">Sale</span>}
        {/* Action buttons on hover */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={(e) => onToggleWishlist(e, product.id)} className={`p-2 rounded-xl shadow-sm backdrop-blur-sm transition-colors ${wishlistIds.has(product.id) ? "bg-red-50 text-red-500" : "bg-white/90 text-gray-500 hover:text-red-500"}`}>
            <Heart size={14} fill={wishlistIds.has(product.id) ? "currentColor" : "none"} />
          </button>
        </div>
        {/* Payment offer badge */}
        {(() => {
          const offer = paymentOffers.find(o => o.productId === product.id || (product.categoryId && o.categoryId === product.categoryId) || (product.category?.id && o.categoryId === product.category.id) || (!o.productId && !o.categoryId))
          if (offer) return <span className={`absolute bottom-2.5 right-2.5 ${offer.offerType === 'BANK' ? 'bg-blue-600' : 'bg-purple-600'} text-white text-[10px] font-bold px-2 py-0.5 rounded-md`}>{getPaymentOfferBadge(offer)}</span>
          return null
        })()}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug min-h-[2.5rem]">{product.title}</h3>
        <div className="flex items-center gap-1.5 mt-1.5">
          {product.rating > 0 && (
            <>
              <div className="flex">{[1, 2, 3, 4, 5].map((s) => (<Star key={s} size={11} className={s <= Math.round(product.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />))}</div>
              <span className="text-[11px] text-gray-400">({product.rating})</span>
            </>
          )}
          {product.sku && <span className="text-[11px] text-gray-400">· {product.sku}</span>}
        </div>
        <div className="mt-2">
          <PriceDisplay isPriceHidden={isPriceHidden} rp={rp} ruleDisc={ruleDisc} product={product} comparePrice={comparePrice} />
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
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
            size="sm"
          />
        </div>
        <div className="body-sm mt-1.5">MOQ: {product.moq}</div>
        {!isNonPurchasable && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(product.id, product.moq) }}
            disabled={addingId === product.id || product.inventoryQuantity <= 0}
            className="mt-3 w-full py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingId === product.id ? "Adding..." : product.inventoryQuantity <= 0 ? t("product.outOfStock") : "Add to Cart"}
          </button>
        )}
      </div>
    </Link>
  )
}

/* Helper: Package icon (inline SVG placeholder) */
function Package2Icon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  )
}

/* Helper: Price display */
function PriceDisplay({ isPriceHidden, rp, ruleDisc, product, comparePrice }: { isPriceHidden: boolean; rp: any; ruleDisc: any; product: Product; comparePrice: boolean | undefined }) {
  if (isPriceHidden) return <span className="text-xs text-gray-500 italic">Login for pricing</span>
  if (rp) return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold text-primary-700">{formatPrice(rp.rolePrice)}</span>
      <span className="text-xs text-gray-400 line-through">{formatPrice(product.unitPrice)}</span>
      <span className="badge badge-success">{rp.savingsPercent}% off</span>
    </div>
  )
  if (ruleDisc) return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold text-primary-700">{formatPrice(Number(product.unitPrice) - ruleDisc.discountAmount)}</span>
      <span className="text-xs text-gray-400 line-through">{formatPrice(product.unitPrice)}</span>
    </div>
  )
  if (product.tierPrices?.length > 0) return (
    <div className="flex items-baseline gap-1">
      <span className="text-xs text-green-600 font-semibold">From</span>
      <span className="text-lg font-bold text-gray-900">{formatPrice(Number(product.tierPrices[product.tierPrices.length - 1].price))}</span>
      {comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
    </div>
  )
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold text-gray-900">{formatPrice(product.unitPrice)}</span>
      {comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
    </div>
  )
}