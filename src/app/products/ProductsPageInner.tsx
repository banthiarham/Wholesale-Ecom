"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { SeasonalDiscount, PaymentOffer, fetchSeasonalDiscounts, fetchPaymentOffers, getProductDiscount } from "@/lib/pricing"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { useCategories, flattenCategories } from "@/lib/categories/CategoriesProvider"
import { ProductCard } from "@/components/ui/ProductCard"
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton"
import { EmptyState } from "@/components/ui/EmptyState"
import { FilterSidebar } from "@/components/storefront/FilterSidebar"
import { ListingToolbar, SortOption, ViewMode } from "@/components/storefront/ListingToolbar"
import { useInfiniteScroll, ScrollSentinel } from "@/lib/useInfiniteScroll"

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

// Five cards per row on desktop; the list scrolls and loads 20 more at a time (no pagination).
const BATCH_SIZE = 20

export default function ProductsPageInner() {
  const [products, setProducts] = useState<Product[]>([])
  const { categories: categoryTree } = useCategories()
  const categories = useMemo(
    () => flattenCategories(categoryTree).map((c) => ({ id: c.id, name: c.name, handle: c.handle })),
    [categoryTree]
  )
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ category: "", minPrice: "", maxPrice: "", inStock: false })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [paymentOffers, setPaymentOffers] = useState<PaymentOffer[]>([])
  const [sort, setSort] = useState<SortOption>("newest")
  const [view, setView] = useState<ViewMode>("grid")
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()
  const searchParams = useSearchParams()

  // Evaluate dynamic rules
  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId || p.category?.id, unitPrice: p.unitPrice })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts, customBadges } = useStorefrontRules(rulesProducts)

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
    fetchSeasonalDiscounts().then(setDiscounts)
    fetchPaymentOffers().then(setPaymentOffers)
    // Seed search from the header's search bar (?search=X, or ?q=X directly),
    // which otherwise never reached this page — same-tick fix via overrideSearch
    // since setSearch() alone wouldn't be visible to the loadProducts() call below.
    const urlSearch = searchParams.get("search") || searchParams.get("q") || ""
    if (urlSearch) {
      setSearch(urlSearch)
      loadProducts(undefined, urlSearch)
    } else {
      loadProducts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProducts = (overrideFilters?: any, overrideSearch?: string) => {
    setLoading(true)
    const f = overrideFilters || filters
    const s = overrideSearch !== undefined ? overrideSearch : search
    const params = new URLSearchParams()
    if (s) params.set("q", s)
    if (f.category) params.set("category", f.category)
    if (f.minPrice) params.set("min_price", f.minPrice)
    if (f.maxPrice) params.set("max_price", f.maxPrice)
    if (f.inStock) params.set("in_stock", "true")
    params.set("limit", "2000") // whole catalogue — the list reveals it as you scroll

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
      const res = await fetch("/api/cart", {
        method: "POST",
        headers,
        body: JSON.stringify({ productId, quantity: qty }),
      })
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

  const toggleWishlist = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const token = localStorage.getItem("token")
    if (!token) { showToast("info", "Please sign in to add items to your wishlist"); return }
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

  const { visibleCount, hasMore, sentinelRef } = useInfiniteScroll(visibleProducts.length, visibleProducts, BATCH_SIZE)
  const shownProducts = visibleProducts.slice(0, visibleCount)

  const clearFilters = () => {
    const r = { category: "", minPrice: "", maxPrice: "", inStock: false }
    setFilters(r)
    loadProducts(r)
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        {/* Header: title on the left; Filters button, search, sort and view toggle on the right */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="heading-lg">{t("products.title")}</h1>
            <p className="body-sm mt-1">Explore our wide range of quality products</p>
          </div>
          <div className="flex flex-col lg:items-end gap-2">
            <p className="body-sm lg:text-right">{visibleProducts.length} products found</p>
            <ListingToolbar
              resultCount={visibleProducts.length}
              showResultCount={false}
              filterButton
              search={search}
              onSearchChange={setSearch}
              onSearchSubmit={() => loadProducts()}
              searchPlaceholder={t("products.search")}
              sort={sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
              hasActiveFilters={!!hasActiveFilters}
              onToggleMobileFilters={() => setMobileFiltersOpen(true)}
            />
          </div>
        </div>

        {/* The same filter fields, now in a popup opened by the Filters button */}
        <FilterSidebar
          variant="popup"
          filters={filters}
          onChange={(f) => setFilters({ ...f, category: f.category ?? "" })}
          onApply={() => { loadProducts(); setMobileFiltersOpen(false) }}
          onClear={() => { clearFilters(); setMobileFiltersOpen(false) }}
          hasActiveFilters={!!hasActiveFilters}
          categories={categories}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />

        <div className="min-w-0">
          {loading ? (
            <ProductGridSkeleton view={view} count={BATCH_SIZE} />
          ) : visibleProducts.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No products found"
              description="Try adjusting your search or filter criteria"
              action={hasActiveFilters ? { label: "Clear All Filters", onClick: clearFilters } : undefined}
            />
          ) : (
            <>
              {/* Product grid (5 per row, same compact cards as the home page) / list */}
              <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
                {shownProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    view={view}
                    showQuantity={view === "grid"}
                    compact={view === "grid"}
                    isPriceHidden={hiddenPriceProductIds.has(product.id)}
                    isNonPurchasable={nonPurchasableProducts.has(product.id)}
                    nonPurchasableMsg={nonPurchasableProducts.get(product.id) || ""}
                    rolePricing={rolePricingMap[product.id]}
                    ruleDiscount={ruleDiscountMap.get(product.id)}
                    bogo={bogoMap.get(product.id)}
                    quantityDiscount={qtyDiscountMap.get(product.id)}
                    customBadges={customBadges}
                    seasonalDiscount={getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)}
                    paymentOffers={paymentOffers}
                    isWishlisted={wishlistIds.has(product.id)}
                    onToggleWishlist={toggleWishlist}
                    isAdding={addingId === product.id}
                    onAddToCart={handleAddToCart}
                    addToCartLabel={t("product.addToCart")}
                    outOfStockLabel={t("product.outOfStock")}
                  />
                ))}
              </div>

              <ScrollSentinel hasMore={hasMore} sentinelRef={sentinelRef} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
