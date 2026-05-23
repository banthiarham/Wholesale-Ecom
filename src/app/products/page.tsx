"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingCart, Search, SlidersHorizontal, X } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

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
  const [filters, setFilters] = useState({ category: "", minPrice: "", maxPrice: "", inStock: false })
  const [showFilters, setShowFilters] = useState(false)
  const { t } = useTranslation()

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
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
        body: JSON.stringify({ productId, quantity: qty }),
      })
      alert(t("products.addToCart"))
    } catch (err) {
      console.error(err)
    } finally {
      setAddingId(null)
    }
  }

  const hasActiveFilters = filters.category || filters.minPrice || filters.maxPrice || filters.inStock

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4 items-center">
            <Link href="/cart" className="text-gray-600 hover:text-primary-600">
              <ShoppingCart size={20} />
            </Link>
          </div>
        </div>
      </header>

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
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                <Link href={`/products/${product.handle}`}>
                  <div className="h-48 bg-gray-100 relative">
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/products/${product.handle}`}>
                    <h3 className="font-semibold text-gray-900 truncate hover:text-primary-600">{product.title}</h3>
                  </Link>
                  {product.sku && <p className="text-xs text-gray-500 mt-1">{t("product.sku")}: {product.sku}</p>}
                  <p className="text-xs text-gray-500">{t("product.moq")}: {product.moq}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-bold text-primary-700">{formatPrice(Number(product.unitPrice))}</span>
                    {product.compareAtPrice && <span className="text-sm text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-yellow-500 text-sm">{"★".repeat(Math.round(product.rating))}</span>
                    <span className="text-xs text-gray-500">({product.rating})</span>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product.id, product.moq)}
                    disabled={addingId === product.id || product.inventoryQuantity <= 0}
                    className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                  >
                    {addingId === product.id ? "Adding..." : product.inventoryQuantity <= 0 ? t("product.outOfStock") : t("product.addToCart")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
