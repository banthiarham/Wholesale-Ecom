"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, ArrowLeft, Search } from "lucide-react"
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

interface Category {
  id: string
  name: string
  handle: string
  description: string | null
  products: Product[]
}

export default function CategoryPage() {
  const params = useParams()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!params.handle) return
    fetch(`/api/store/categories/${params.handle}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.category) setCategory(data.category)
        setLoading(false)
      })
  }, [params.handle])

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
        <h1 className="text-2xl font-bold">Category not found</h1>
        <Link href="/products" className="mt-4 text-primary-600">Browse products</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4 items-center">
            <Link href="/products" className="text-gray-600 hover:text-primary-600">Products</Link>
            <Link href="/cart" className="text-gray-600 hover:text-primary-600">Cart</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/products"
          className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"
        >
          <ArrowLeft size={16} /> All products
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
          {category.description && (
            <p className="text-gray-600 mt-2">{category.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">{category.products.length} products</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {category.products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition"
            >
              <Link href={`/products/${product.handle}`}>
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
              </Link>
              <div className="p-4">
                <Link href={`/products/${product.handle}`}>
                  <h3 className="font-semibold text-gray-900 truncate hover:text-primary-600">
                    {product.title}
                  </h3>
                </Link>
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
                <button
                  onClick={() => handleAddToCart(product.id, product.moq)}
                  disabled={addingId === product.id || product.inventoryQuantity <= 0}
                  className="mt-3 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
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
      </main>
    </div>
  )
}
