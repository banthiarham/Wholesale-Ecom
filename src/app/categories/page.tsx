"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface Category {
  id: string
  name: string
  handle: string
  description: string | null
  image: string | null
  _count: { products: number }
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => { setCategories(Array.isArray(data.categories) ? data.categories : []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shop by Category</h1>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <p className="text-gray-600">No categories available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.handle}`} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition group">
                <div className="h-48 bg-gray-100 relative">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">{cat.name.charAt(0)}</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-xl font-bold">{cat.name}</h3>
                    <p className="text-sm opacity-90">{cat._count.products} products</p>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500 line-clamp-1">{cat.description || "Browse collection"}</p>
                  <span className="text-primary-600 text-sm font-medium group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
