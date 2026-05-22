"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ShoppingCart, ArrowLeft, Star, Truck, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface TierPrice { id: string; minQty: number; maxQty: number | null; price: number }

interface Review { id: string; rating: number; title: string | null; body: string | null; user: { firstName: string | null; lastName: string | null } }

interface Product {
  id: string; title: string; handle: string; description: string | null; sku: string | null; moq: number;
  unitPrice: number; compareAtPrice: number | null; inventoryQuantity: number; thumbnail: string | null;
  vendorName: string | null; rating: number; reviewCount: number; tags: string[];
  category: { id: string; name: string; handle: string } | null;
  tierPrices: TierPrice[]; reviews: Review[];
}

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!params.handle) return
    fetch(`/api/products/${params.handle}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) { setProduct(data.product); setQuantity(data.product.moq) }
        setLoading(false)
      })
  }, [params.handle])

  const handleAddToCart = async () => {
    if (!product) return
    setAdding(true)
    try {
      await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id, quantity }) })
      alert("Added to cart!")
    } catch (err) { console.error(err) } finally { setAdding(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
  if (!product) return <div className="min-h-screen flex flex-col items-center justify-center"><h1 className="text-2xl font-bold">Product not found</h1><Link href="/products" className="mt-4 text-primary-600">Back to products</Link></div>

  const effectivePrice = product.tierPrices.find((tp) => quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty))?.price || product.unitPrice

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4">
            <Link href="/products" className="text-gray-600 hover:text-primary-600">Products</Link>
            <Link href="/cart" className="text-gray-600 hover:text-primary-600">Cart</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/products" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to products</Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg overflow-hidden">
            {product.thumbnail ? (
              <img src={product.thumbnail} alt={product.title} className="w-full h-96 object-cover" />
            ) : (
              <div className="w-full h-96 bg-gray-100 flex items-center justify-center text-gray-400">No Image</div>
            )}
          </div>

          <div className="space-y-4">
            {product.category && <Link href={`/categories/${product.category.handle}`} className="text-sm text-primary-600 hover:underline">{product.category.name}</Link>}
            <h1 className="text-3xl font-bold text-gray-900">{product.title}</h1>

            <div className="flex items-center gap-2">
              <div className="flex text-yellow-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={18} fill={i < Math.round(product.rating) ? "currentColor" : "none"} className={i < Math.round(product.rating) ? "" : "text-gray-300"} />)}</div>
              <span className="text-sm text-gray-500">({product.reviewCount} reviews)</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary-700">{formatPrice(Number(effectivePrice))}</span>
              {product.compareAtPrice && effectivePrice < product.compareAtPrice && <span className="text-lg text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>}
            </div>

            {product.sku && <p className="text-sm text-gray-500">SKU: {product.sku}</p>}
            {product.vendorName && <p className="text-sm text-gray-500">Vendor: {product.vendorName}</p>}
            <div className="flex items-center gap-2 text-sm text-gray-600"><Package size={16} /><span>MOQ: {product.moq} units</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><Truck size={16} /><span>{product.inventoryQuantity > 0 ? `${product.inventoryQuantity} in stock` : "Out of stock"}</span></div>

            {product.tierPrices.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Tier Pricing</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Quantity</th><th className="px-3 py-2 text-right">Price/unit</th></tr></thead>
                  <tbody>
                    {product.tierPrices.map((tp) => (
                      <tr key={tp.id} className={`border-b ${quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty) ? "bg-primary-50 font-medium" : ""}`}>
                        <td className="px-3 py-2">{tp.minQty}{tp.maxQty ? ` - ${tp.maxQty}` : "+"}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(Number(tp.price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button onClick={() => setQuantity(Math.max(product.moq, quantity - 1))} className="px-3 py-2 hover:bg-gray-50">-</button>
                <input type="number" min={product.moq} max={product.inventoryQuantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-16 text-center border-x border-gray-200 py-2" />
                <button onClick={() => setQuantity(Math.min(product.inventoryQuantity, quantity + 1))} className="px-3 py-2 hover:bg-gray-50">+</button>
              </div>
              <button onClick={handleAddToCart} disabled={adding || product.inventoryQuantity <= 0 || quantity < product.moq} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
003e
                <ShoppingCart size={18} /> {adding ? "Adding..." : "Add to Cart"}
              </button>
            </div>

            {product.tags.length > 0 && <div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">{tag}</span>)}</div>}
          </div>
        </div>

        {product.description && (
          <div className="mt-8 bg-white rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
          </div>
        )}

        {product.reviews.length > 0 && (
          <div className="mt-8 bg-white rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Reviews</h2>
            <div className="space-y-4">
              {product.reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex text-yellow-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-gray-300"} />)}</div>
                    <span className="text-sm font-medium">{review.user.firstName || "Anonymous"} {review.user.lastName || ""}</span>
                  </div>
                  {review.title && <h4 className="font-medium mt-1">{review.title}</h4>}
                  {review.body && <p className="text-gray-600 text-sm mt-1">{review.body}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
