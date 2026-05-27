"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ShoppingCart,
  ArrowLeft,
  Star,
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
  Filter,
  Flame,
} from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount, discountBadge } from "@/lib/pricing"

interface Product {
  id: string
  title: string
  handle: string
  sku: string | null
  thumbnail: string | null
  images: string[]
  unitPrice: string
  compareAtPrice: string | null
  moq: number
  inventoryQuantity: number
  rating: number
  reviewCount: number
  vendorName: string | null
  tierPrices: { minQty: number; maxQty: number | null; price: string }[]
  categoryId?: string
  category?: { id: string }
}

interface Category {
  id: string
  name: string
  handle: string
  description: string | null
  products: Product[]
}

const categoryMeta: Record<string, { icon: any; gradient: string }> = {
  electronics: { icon: Cpu, gradient: "from-blue-600 to-cyan-500" },
  fashion: { icon: Shirt, gradient: "from-pink-500 to-rose-400" },
  industrial: { icon: Wrench, gradient: "from-amber-600 to-orange-500" },
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
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])

  useEffect(() => {
    if (!params.handle) return
    fetch(`/api/categories/${params.handle}`)
      .then((res) => res.json())
      .then((data) => { if (data.category) setCategory(data.category); setLoading(false) })
    fetchSeasonalDiscounts().then(setDiscounts)
  }, [params.handle])

  const handleAddToCart = async (productId: string, qty: number) => {
    setAddingId(productId)
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
        body: JSON.stringify({ productId, quantity: qty }),
      })
      window.dispatchEvent(new CustomEvent("cart-updated"))
    } catch (err) {
      console.error(err)
    } finally {
      setAddingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!category) {
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
      <div className="min-h-screen bg-gray-50">
      {/* Category hero banner */}
      <section className={`relative bg-gradient-to-br ${meta.gradient} overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-white rounded-full blur-3xl translate-y-8 -translate-x-8" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <Link href="/categories" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-6 transition">
            <ArrowLeft size={16} /> All Categories
          </Link>
          <div className="flex items-center gap-5 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Icon size={30} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white">{category.name}</h1>
              {category.description && (
                <p className="text-white/70 mt-1 max-w-lg">{category.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 mt-6">
            <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-semibold rounded-full">
              {category.products.length} {category.products.length === 1 ? "Product" : "Products"}
            </span>
          </div>
        </div>
      </section>

      {/* Products grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {category.products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No products in this category yet</p>
            <Link href="/products" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
              Browse all products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {category.products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.handle}`}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group"
              >
                <div className="relative h-48 bg-gray-100">
                  {product.thumbnail || product.images?.[0] ? (
                    <img
                      src={product.thumbnail || product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={40} className="text-gray-300" />
                    </div>
                  )}
                  {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice) && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded">
                      {Math.round(((Number(product.compareAtPrice) - Number(product.unitPrice)) / Number(product.compareAtPrice)) * 100)}% OFF
                    </span>
                  )}
                  {(() => {
                    const disc = getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)
                    if (disc) return <span className="absolute top-3 left-3 px-2 py-0.5 bg-orange-500 text-white text-xs font-semibold rounded flex items-center gap-1"><Flame size={10} />{disc.name}</span>
                    return null
                  })()}
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                    MOQ: {product.moq}
                  </span>
                  {product.tierPrices && product.tierPrices.length > 0 && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">
                      Bulk Pricing
                    </span>
                  )}
                  {product.inventoryQuantity <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="px-3 py-1 bg-white text-gray-900 text-xs font-bold rounded">Out of Stock</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition">{product.title}</h3>
                  {product.sku && <p className="text-xs text-gray-400 mb-1">SKU: {product.sku}</p>}
                  {product.vendorName && <p className="text-xs text-gray-400 mb-2">{product.vendorName}</p>}
                  {product.rating > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-gray-600">{product.rating}</span>
                      <span className="text-xs text-gray-400">({product.reviewCount})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {product.tierPrices && product.tierPrices.length > 0 ? (
                      <>
                        <span className="text-xs text-green-600 font-semibold">From </span>
                        <span className="text-lg font-bold text-gray-900">{formatPrice(product.tierPrices[product.tierPrices.length - 1].price)}</span>
                        <span className="text-sm text-gray-400 line-through">{formatPrice(product.unitPrice)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-gray-900">{formatPrice(product.unitPrice)}</span>
                        {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice) && (
                          <span className="text-sm text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      if (product.inventoryQuantity > 0) handleAddToCart(product.id, product.moq)
                    }}
                    disabled={addingId === product.id || product.inventoryQuantity <= 0}
                    className="w-full py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={16} />
                    {addingId === product.id ? "Adding..." : product.inventoryQuantity <= 0 ? "Out of Stock" : `Add ${product.moq} to Cart`}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
    </>
  )
}