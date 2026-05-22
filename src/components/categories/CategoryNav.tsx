"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Category {
  id: string
  name: string
  handle: string
  image: string | null
  children: Category[]
  _count?: { products: number }
}

export default function CategoryNav() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categories/${category.handle}`}
          className="group relative bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition"
        >
          <div className="h-40 bg-gray-100 relative">
            {category.image ? (
              <img
                src={category.image}
                alt={category.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
                {category.name[0]}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-3 text-white">
              <h3 className="text-lg font-semibold">{category.name}</h3>
              <p className="text-xs opacity-90">{category._count?.products || 0} products</p>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Browse collection</span>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-600 transition" />
            </div>
            {category.children.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {category.children.slice(0, 3).map((child) => (
                  <span key={child.id} className="text-xs px-2 py-1 bg-gray-100 rounded">{child.name}</span>
                ))}
                {category.children.length > 3 && (
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">+{category.children.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
