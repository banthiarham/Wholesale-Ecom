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
  Search,
  SlidersHorizontal,
  X,
  Grid3X3,
  List,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
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

type SortOption = "newest" | "price_asc" | "price_desc" | "rating" | "name"
type ViewMode = "grid" | "list"
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
  const [showFilters, setShowFilters] = useState(false)
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

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white border-b border-gray-100 shadow-sm animate-fade-in-up">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="heading-sm">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <button onClick={clearFilters} className="btn-outline">Clear All</button>
                )}
              </div>
            </div>
          </div>
        )}

        <main className="section-container py-8">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <p className="body-sm">{visibleProducts.length} products found</p>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={t("products.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadProducts()}
                  className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-40 sm:w-52 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              {/* Sort */}
              <div className="relative hidden sm:block">
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
              <button onClick={() => setShowFilters(!showFilters)} className={`p-2.5 rounded-xl border transition-all ${hasActiveFilters ? "border-primary-300 text-primary-600 bg-primary-50" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"}`}>
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
              <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" : "space-y-3"}>
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
    </>
  )
}
