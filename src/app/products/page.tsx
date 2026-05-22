"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, Search } from "lucide-react"
import { formatPrice } from "@/lib/utils"

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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || [])
        setLoading(false)
      })
  }, [])

  const handleAddToCart = async (productId: string, qty: number) => {
    setAddingId(productId)
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty }),
      })
      alert("Added to cart!")
    } catch (err) {
      console.error(err)
    } finally {
      setAddingId(null)
    }
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
              />
            </div>
            <Link href="/cart" className="text-gray-600 hover:text-primary-600">
              <ShoppingCart size={20} />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Products</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition"
              >
                <div className="h-48 bg-gray-100 relative">
                  {product.thumbnail ? (
                    <Image
                      src={product.thumbnail}
                      alt={product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{product.title}</h3>
                  {product.sku && (
                    <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                  )}
                  <p className="text-xs text-gray-500">MOQ: {product.moq}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-bold text-primary-700">{formatPrice(Number(product.unitPrice))}</span>
                    {product.compareAtPrice && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatPrice(Number(product.compareAtPrice))}
                      </span>
                    )}
                  </div>
                  {product.vendorName && (
                    <p className="text-xs text-gray-500 mt-1">{product.vendorName}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-yellow-500">{"★".repeat(Math.round(product.rating))}</span>
                    <span className="text-xs text-gray-500">({product.rating})</span>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product.id, product.moq)}
                    disabled={addingId === product.id || product.inventoryQuantity <= 0}
                    className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingId === product.id
                      ? "Adding..."
                      : product.inventoryQuantity <= 0
                      ? "Out of Stock"
                      : `Add ${product.moq} to Cart`}
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
