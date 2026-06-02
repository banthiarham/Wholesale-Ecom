"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface Category {
  id: string
  name: string
  handle: string
  image: string | null
  _count?: { products: number }
  children?: Category[]
}

interface ShopByCategoryGridProps {
  columns?: number
}

export default function ShopByCategoryGrid({ columns = 4 }: ShopByCategoryGridProps) {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const roots: Category[] = data.categories || []
        setCategories(roots)
      })
      .catch(() => {})
  }, [])

  if (categories.length === 0) return null

  const gridCols = `grid-cols-2 sm:grid-cols-${Math.min(columns, 3)} lg:grid-cols-${columns}`

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Shop by Category</h2>
            <p className="text-gray-500">Browse products by industry</p>
          </div>
          <Link href="/categories" className="hidden sm:flex items-center gap-1 text-primary-600 font-semibold hover:gap-2 transition-all text-sm">
            All Categories <ArrowRight size={16} />
          </Link>
        </div>
        <div className={`grid ${gridCols} gap-4 sm:gap-6`}>
          {categories.slice(0, columns * 2).map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.handle}`}
              className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="h-32 sm:h-40 bg-gray-100 relative overflow-hidden">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">{cat.name[0]}</div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-600 transition">{cat.name}</h3>
                {cat._count && <p className="text-xs text-gray-500 mt-0.5">{cat._count.products} products</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}