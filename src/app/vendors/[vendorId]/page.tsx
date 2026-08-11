"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Store, Package } from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { useStorefrontRules } from "@/lib/rules"
import { ProductCard } from "@/components/ui/ProductCard"
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton"
import { EmptyState } from "@/components/ui/EmptyState"

interface Product {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  unitPrice: number
  compareAtPrice: number | null
  moq: number
  inventoryQuantity: number
  rating: number
  vendorName: string | null
  tags: string[]
  categoryId?: string
  category?: { id: string }
  tierPrices: { minQty: number; maxQty: number | null; price: number }[]
}

// Lightweight vendor storefront — there's no dedicated Vendor entity in the data
// model (Product.vendorId is an unenforced string column, not a FK), so this
// page derives the vendor's display name from the denormalized vendorName field
// already present on their products, using the existing public
// GET /products?vendor=<id> endpoint. No bio/logo/join-date, since that data
// isn't stored anywhere yet.
export default function VendorProductListingPage() {
  const params = useParams()
  const vendorId = typeof params.vendorId === "string" ? params.vendorId : ""
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

  // Evaluate dynamic rules so the top-left image badge shows immediately on
  // load, same as the main product listing — independent of quantity/cart.
  const rulesProducts = useMemo(
    () => products.map((p) => ({ id: p.id, categoryId: p.categoryId || p.category?.id, unitPrice: p.unitPrice })),
    [products]
  )
  const { customBadges } = useStorefrontRules(rulesProducts)

  useEffect(() => {
    if (!vendorId) return
    fetch(`/api/products?vendor=${vendorId}&take=100`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => { setProducts(data.products || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [vendorId])

  const handleAddToCart = async (productId: string, qty: number) => {
    setAddingId(productId)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId, quantity: qty }) })
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

  const vendorName = products.find((p) => p.vendorName)?.vendorName || "Vendor"

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Products
        </Link>

        {/* Vendor header */}
        <div className="card-base-static p-6 mb-8 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 text-white flex items-center justify-center shrink-0">
            <Store size={28} />
          </div>
          <div>
            <span className="eyebrow">Vendor Storefront</span>
            <h1 className="heading-lg">{vendorName}</h1>
            {!loading && <p className="body-sm mt-1">{products.length} product{products.length !== 1 ? "s" : ""} available</p>}
          </div>
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description="This vendor doesn't have any published products right now."
            action={{ label: "Browse all products", href: "/products" }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                view="grid"
                customBadges={customBadges}
                isAdding={addingId === product.id}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
