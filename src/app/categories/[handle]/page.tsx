"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Package,
  Cpu,
  Shirt,
  Wrench,
  Sparkles,
  Utensils,
  Heart,
  BookOpen,
  Dumbbell,
  Paintbrush,
} from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { SeasonalDiscount, PaymentOffer, fetchSeasonalDiscounts, fetchPaymentOffers, getProductDiscount } from "@/lib/pricing"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton"
import { EmptyState } from "@/components/ui/EmptyState"
import { FilterSidebar } from "@/components/storefront/FilterSidebar"
import { ListingToolbar, SortOption, ViewMode } from "@/components/storefront/ListingToolbar"
import { Pagination } from "@/components/storefront/Pagination"

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
  reviewCount: number
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
  description: string | null
}

const PRODUCTS_PER_PAGE = 12

const categoryMeta: Record<string, { icon: any; gradient: string }> = {
  electronics: { icon: Cpu, gradient: "from-blue-600 to-cyan-500" },
  fashion: { icon: Shirt, gradient: "from-pink-500 to-rose-400" },
  industrial: { icon: Wrench, gradient: "from-amber-600 to-orange-500" },
  "home-kitchen": { icon: Utensils, gradient: "from-green-600 to-emerald-500" },
  "health-beauty": { icon: Sparkles, gradient: "from-purple-500 to-pink-400" },
  food: { icon: Utensils, gradient: "from-green-600 to-emerald-500" },
  health: { icon: Heart, gradient: "from-red-500 to-pink-500" },
  books: { icon: BookOpen, gradient: "from-indigo-600 to-violet-500" },
  sports: { icon: Dumbbell, gradient: "from-teal-500 to-cyan-500" },
  art: { icon: Paintbrush, gradient: "from-fuchsia-500 to-purple-500" },
  beauty: { icon: Sparkles, gradient: "from-purple-500 to-pink-400" },
}

const defaultMeta = { icon: Package, gradient: "from-gray-600 to-slate-500" }

function getMeta(handle: string) {
  return categoryMeta[handle.toLowerCase()] || defaultMeta
}

export default function CategoryPage() {
  const params = useParams()
  const handle = typeof params.handle === "string" ? params.handle : ""

  const [category, setCategory] = useState<Category | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [categoryLoading, setCategoryLoading] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ minPrice: "", maxPrice: "", inStock: false })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [paymentOffers, setPaymentOffers] = useState<PaymentOffer[]>([])
  const [sort, setSort] = useState<SortOption>("newest")
  const [view, setView] = useState<ViewMode>("grid")
  const [page, setPage] = useState(1)

  const { t } = useTranslation()
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

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

  // Load category metadata
  useEffect(() => {
    if (!handle) return
    setCategoryLoading(true)
    setNotFound(false)
    fetch(`/api/categories/${handle}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); setCategoryLoading(false); return }
        const data = await res.json()
        if (data.category) setCategory(data.category)
        else setNotFound(true)
        setCategoryLoading(false)
      })
      .catch(() => { setNotFound(true); setCategoryLoading(false) })
  }, [handle])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      fetch("/api/wishlist", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data) => { setWishlistIds(new Set((data.items || []).map((i: any) => i.productId))) })
        .catch(() => {})
    }
    fetchSeasonalDiscounts().then(setDiscounts)
    fetchPaymentOffers().then(setPaymentOffers)
  }, [])

  const loadProducts = (overrideFilters?: typeof filters) => {
    if (!category) return
    setProductsLoading(true)
    const f = overrideFilters || filters
    const params = new URLSearchParams()
    params.set("category", category.id)
    if (search) params.set("q", search)
    if (f.minPrice) params.set("min_price", f.minPrice)
    if (f.maxPrice) params.set("max_price", f.maxPrice)
    if (f.inStock) params.set("in_stock", "true")

    fetch(`/api/products?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) { setProducts([]); setProductsLoading(false); return }
        const data = await res.json()
        setProducts(data.products || [])
        setProductsLoading(false)
        setPage(1)
      })
      .catch(() => { setProducts([]); setProductsLoading(false) })
  }

  useEffect(() => {
    if (category) loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

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

  const hasActiveFilters = filters.minPrice || filters.maxPrice || filters.inStock

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
      default:
        break
    }
    return filtered
  }, [products, hiddenProductIds, sort])

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE))
  const paginatedProducts = visibleProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE)

  const clearFilters = () => {
    const r = { minPrice: "", maxPrice: "", inStock: false }
    setFilters(r)
    loadProducts(r)
  }

  if (categoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (notFound || !category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Package size={48} className="text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Category not found</h1>
        <Link href="/categories" className="text-primary-600 hover:underline">Browse all categories</Link>
      </div>
    )
  }

  const meta = getMeta(category.handle)
  const Icon = meta.icon

  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description || `Browse wholesale ${category.name} products at bulk prices.`,
    url: typeof window !== "undefined" ? `${window.location.origin}/categories/${category.handle}` : undefined,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }} />
      <div className="min-h-screen bg-gray-50/50">
        {/* Category hero banner */}
        <section className={`relative bg-gradient-to-br ${meta.gradient} overflow-hidden`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl -translate-y-12 translate-x-12" />
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-white rounded-full blur-3xl translate-y-8 -translate-x-8" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
            <Link href="/categories" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-5 transition">
              <ArrowLeft size={16} /> All Categories
            </Link>
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">{category.name}</h1>
                {category.description && (
                  <p className="text-white/70 mt-1 max-w-lg text-sm">{category.description}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <main className="section-container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              onApply={() => { loadProducts(); setMobileFiltersOpen(false) }}
              onClear={() => { clearFilters(); setMobileFiltersOpen(false) }}
              hasActiveFilters={!!hasActiveFilters}
              mobileOpen={mobileFiltersOpen}
              onMobileClose={() => setMobileFiltersOpen(false)}
            />

            <div className="min-w-0">
              <ListingToolbar
                resultCount={visibleProducts.length}
                search={search}
                onSearchChange={setSearch}
                onSearchSubmit={() => loadProducts()}
                searchPlaceholder={t("products.search")}
                sort={sort}
                onSortChange={(s) => { setSort(s); setPage(1) }}
                view={view}
                onViewChange={setView}
                hasActiveFilters={!!hasActiveFilters}
                onToggleMobileFilters={() => setMobileFiltersOpen(true)}
              />

              <div className="pt-6">
                {productsLoading ? (
                  <ProductGridSkeleton view={view} count={PRODUCTS_PER_PAGE} />
                ) : visibleProducts.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No products found"
                    description={hasActiveFilters || search ? "Try adjusting your search or filter criteria" : "No products in this category yet"}
                    action={hasActiveFilters ? { label: "Clear All Filters", onClick: clearFilters } : { label: "Browse all products", href: "/products" }}
                  />
                ) : (
                  <>
                    <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" : "space-y-3"}>
                      {paginatedProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          view={view}
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

                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
