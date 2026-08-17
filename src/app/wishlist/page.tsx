"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Heart, Package } from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { useStorefrontRules } from "@/lib/rules"
import { ProductCard } from "@/components/ui/ProductCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton"

interface TierPrice { minQty: number; maxQty: number | null; price: string }

interface WishlistProduct {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  unitPrice: string
  compareAtPrice: string | null
  moq: number
  inventoryQuantity: number
  categoryId?: string | null
  tierPrices: TierPrice[]
}

interface WishlistItem {
  id: string
  productId: string
  createdAt: string
  product: WishlistProduct
}

export default function WishlistPage() {
  const router = useRouter()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

  // Evaluate dynamic rules so the top-left image badge shows immediately on
  // load, same as the main product listing — independent of quantity/cart.
  const rulesProducts = useMemo(
    () => items.map((item) => ({ id: item.product.id, categoryId: item.product.categoryId || undefined, unitPrice: Number(item.product.unitPrice) })),
    [items]
  )
  const { customBadges } = useStorefrontRules(rulesProducts)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { setLoading(false); return }
    fetch("/api/wishlist", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return null }
        return res.json()
      })
      .then((data) => {
        if (data) setItems(data.items || [])
        setLoading(false)
      })
      .catch((err) => { console.error(err); setError("Failed to load wishlist"); setLoading(false) })
  }, [router])

  const handleRemove = async (productId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`/api/wishlist/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.productId !== productId))
      } else {
        showToast("error", "Could not remove item")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    }
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

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <ProductGridSkeleton count={8} />
      </main>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50/50">
      <EmptyState
        icon={Heart}
        title="Failed to load wishlist"
        description={error}
        action={{ label: "Retry", onClick: () => window.location.reload() }}
      />
    </div>
  )

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  if (!token) return (
    <div className="min-h-screen bg-gray-50/50">
      <EmptyState
        icon={Heart}
        title="Sign in to view your wishlist"
        description="Save products you're interested in by signing in."
        action={{ label: "Sign In", href: "/login" }}
      />
    </div>
  )

  if (items.length === 0) return (
    <div className="min-h-screen bg-gray-50/50">
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Save products you're interested in to buy later."
        action={{ label: "Browse Products", href: "/products" }}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="heading-lg">My Wishlist</h1>
            <p className="body-sm mt-1">{items.length} saved item{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              product={{ ...item.product, categoryId: item.product.categoryId || undefined }}
              view="grid"
              isWishlisted
              customBadges={customBadges}
              onToggleWishlist={(e, productId) => { e.preventDefault(); e.stopPropagation(); handleRemove(productId) }}
              isAdding={addingId === item.product.id}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
