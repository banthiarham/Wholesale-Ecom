"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GitCompare, X, ShoppingCart, Star, Package } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"

interface TierPrice { minQty: number; maxQty: number | null; price: string }

interface CompareProduct {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  unitPrice: string
  compareAtPrice: string | null
  moq: number
  inventoryQuantity: number
  rating: number
  reviewCount: number
  vendorName: string | null
  sku: string | null
  tierPrices: TierPrice[]
  category: { name: string } | null
}

export default function ComparePage() {
  const router = useRouter()
  const [products, setProducts] = useState<CompareProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("compareItems")
    if (!stored || stored === "[]") { setLoading(false); return }

    const ids: string[] = JSON.parse(stored)
    Promise.all(
      ids.map((id) =>
        fetch(`/api/products/${id}`).then((r) => r.json()).then((d) => d.product).catch(() => null)
      )
    ).then((results) => {
      setProducts(results.filter(Boolean) as CompareProduct[])
      setLoading(false)
    })
  }, [])

  const removeFromCompare = (id: string) => {
    const updated = products.filter((p) => p.id !== id)
    setProducts(updated)
    localStorage.setItem("compareItems", JSON.stringify(updated.map((p) => p.id)))
  }

  const clearAll = () => {
    setProducts([])
    localStorage.setItem("compareItems", JSON.stringify([]))
  }

  const handleAddToCart = async (product: CompareProduct) => {
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

  if (products.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center max-w-md">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <GitCompare size={36} className="text-blue-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">No products to compare</h1>
        <p className="text-sm text-gray-500 mb-6">Add products to compare from the product listing page.</p>
        <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
          <Package size={18} /> Browse Products
        </Link>
      </div>
    </div>
  )

  const rows: { label: string; render: (p: CompareProduct) => React.ReactNode }[] = [
    { label: "Image", render: (p) => (
      <div className="h-40 bg-gray-100 rounded-lg overflow-hidden">
        {p.thumbnail ? <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-gray-300" /></div>}
      </div>
    )},
    { label: "Product", render: (p) => <Link href={`/products/${p.handle}`} className="font-semibold text-gray-900 hover:text-primary-600 transition">{p.title}</Link> },
    { label: "Category", render: (p) => <span className="text-sm text-gray-600">{p.category?.name || "-"}</span> },
    { label: "Vendor", render: (p) => <span className="text-sm text-gray-600">{p.vendorName || "-"}</span> },
    { label: "Price", render: (p) => {
      const lowest = p.tierPrices?.length > 0 ? p.tierPrices[p.tierPrices.length - 1] : null
      return (
        <div>
          {lowest ? (
            <>
              <span className="text-xs text-green-600 font-semibold">From </span>
              <span className="text-lg font-bold text-gray-900">{formatPrice(lowest.price)}</span>
              <div><span className="text-sm text-gray-400 line-through">{formatPrice(p.unitPrice)}</span></div>
            </>
          ) : (
            <span className="text-lg font-bold text-gray-900">{formatPrice(p.unitPrice)}</span>
          )}
          {p.compareAtPrice && Number(p.compareAtPrice) > Number(p.unitPrice) && (
            <div><span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{Math.round(((Number(p.compareAtPrice) - Number(p.unitPrice)) / Number(p.compareAtPrice)) * 100)}% off</span></div>
          )}
        </div>
      )
    }},
    { label: "MOQ", render: (p) => <span className="text-sm font-medium text-gray-900">{p.moq} units</span> },
    { label: "Stock", render: (p) => <span className={`text-sm font-medium ${p.inventoryQuantity > 0 ? "text-green-600" : "text-red-500"}`}>{p.inventoryQuantity > 0 ? `${p.inventoryQuantity} available` : "Out of stock"}</span> },
    { label: "Rating", render: (p) => (
      <div className="flex items-center gap-1">
        <Star size={14} className="text-amber-400 fill-amber-400" />
        <span className="text-sm text-gray-700">{p.rating}</span>
        <span className="text-xs text-gray-400">({p.reviewCount})</span>
      </div>
    )},
    { label: "SKU", render: (p) => <span className="text-xs text-gray-500">{p.sku || "-"}</span> },
    { label: "Tier Pricing", render: (p) => p.tierPrices?.length > 0 ? (
      <div className="space-y-1">
        {p.tierPrices.map((tp, i) => (
          <div key={i} className="text-xs text-gray-600">{tp.minQty}{tp.maxQty ? `-${tp.maxQty}` : "+"}: {formatPrice(tp.price)}/u</div>
        ))}
      </div>
    ) : <span className="text-xs text-gray-400">No tier pricing</span> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compare Products</h1>
            <p className="text-sm text-gray-500 mt-1">Side-by-side comparison of {products.length} product{products.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={clearAll} className="text-sm text-gray-500 hover:text-red-500 transition">Clear All</button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32"></th>
                {products.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center relative">
                    <button onClick={() => removeFromCompare(p.id)} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition"><X size={14} /></button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{row.label}</td>
                  {products.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-center">{row.render(p)}</td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-gray-200">
                <td className="px-4 py-4"></td>
                {products.map((p) => (
                  <td key={p.id} className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleAddToCart(p)}
                      disabled={addingId === p.id || p.inventoryQuantity <= 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                    >
                      <ShoppingCart size={14} /> {addingId === p.id ? "Adding..." : "Add to Cart"}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}