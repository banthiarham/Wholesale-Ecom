"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Heart, ShoppingCart, Trash2, Package } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"

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
      }
    } catch (err) { console.error(err) }
  }

  const handleAddToCart = async (product: WishlistProduct) => {
    setAddingId(product.id)
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
        body: JSON.stringify({ productId: product.id, quantity: product.moq }),
      })
      window.dispatchEvent(new CustomEvent("cart-updated"))
    } catch (err) { console.error(err) } finally { setAddingId(null) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
      <p className="text-red-500 mb-4">{error}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary-600 text-white rounded-lg">Retry</button>
    </div>
  )

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  if (!token) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center max-w-md">
        <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Heart size={36} className="text-pink-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to view your wishlist</h1>
        <p className="text-sm text-gray-500 mb-6">Save products you're interested in by signing in.</p>
        <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
          Sign In
        </Link>
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center max-w-md">
        <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Heart size={36} className="text-pink-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your wishlist is empty</h1>
        <p className="text-sm text-gray-500 mb-6">Save products you're interested in to buy later.</p>
        <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
          <Package size={18} /> Browse Products
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
            <p className="text-sm text-gray-500 mt-1">{items.length} saved item{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => {
            const p = item.product
            const lowestTier = p.tierPrices?.length > 0 ? p.tierPrices[p.tierPrices.length - 1] : null
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition group">
                <Link href={`/products/${p.handle}`}>
                  <div className="relative h-48 bg-gray-100">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-gray-300" /></div>
                    )}
                    {p.compareAtPrice && Number(p.compareAtPrice) > Number(p.unitPrice) && (
                      <span className="absolute top-3 left-3 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded">
                        {Math.round(((Number(p.compareAtPrice) - Number(p.unitPrice)) / Number(p.compareAtPrice)) * 100)}% OFF
                      </span>
                    )}
                    <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/60 text-white text-xs rounded">MOQ: {p.moq}</span>
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/products/${p.handle}`}>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition">{p.title}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mb-3">
                    {lowestTier ? (
                      <>
                        <span className="text-xs text-green-600 font-semibold">From </span>
                        <span className="text-lg font-bold text-gray-900">{formatPrice(lowestTier.price)}</span>
                        <span className="text-sm text-gray-400 line-through">{formatPrice(p.unitPrice)}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-gray-900">{formatPrice(p.unitPrice)}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddToCart(p)}
                      disabled={addingId === p.id || p.inventoryQuantity <= 0}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                    >
                      <ShoppingCart size={14} /> {addingId === p.id ? "Adding..." : p.inventoryQuantity <= 0 ? "Out of Stock" : "Add to Cart"}
                    </button>
                    <button onClick={() => handleRemove(p.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="Remove from wishlist">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}