"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Package } from "lucide-react"

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

const GRID_MAP: Record<number, string> = {
  2: "grid-cols-2",
  3: "sm:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}

const COLORS = [
  "from-blue-500 to-blue-600", "from-violet-500 to-violet-600", "from-emerald-500 to-emerald-600",
  "from-orange-500 to-orange-600", "from-cyan-500 to-cyan-600", "from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600", "from-indigo-500 to-indigo-600", "from-teal-500 to-teal-600",
  "from-sky-500 to-sky-600", "from-fuchsia-500 to-fuchsia-600", "from-lime-500 to-lime-600",
]

export default function ShopByCategoryGrid({ columns = 4 }: ShopByCategoryGridProps) {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const roots: Category[] = data.categories || []
        setCategories(roots)
      })
      .catch((err) => { console.error("Failed to fetch categories:", err) })
  }, [])

  if (categories.length === 0) return null

  const smCols = GRID_MAP[Math.min(columns, 3)] || "sm:grid-cols-3"
  const lgCols = GRID_MAP[columns] || "lg:grid-cols-4"

  return (
    <section className="section-padding-tight bg-gray-50/60">
      <div className="section-container">
        <div className="section-header">
          <div>
            <span className="eyebrow">Industries</span>
            <h2 className="heading-lg">Shop by Category</h2>
            <p className="body-sm mt-1.5">Browse products by industry</p>
          </div>
          <Link href="/categories" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-white transition-all duration-200">
            All Categories <ArrowRight size={16} />
          </Link>
        </div>
        <div className={`grid grid-cols-2 ${smCols} ${lgCols} gap-4 sm:gap-5`}>
          {categories.slice(0, columns * 2).map((cat, i) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.handle}`}
              className="group card-base overflow-hidden bg-white"
            >
              <div className="h-40 sm:h-48 relative overflow-hidden">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center`}>
                    <Package size={44} className="text-white/70" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-2">
                  <span className="text-white font-bold text-lg tracking-tight drop-shadow-md leading-tight">{cat.name}</span>
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-600 transition-colors">{cat.name}</h3>
                {cat._count && (
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">{cat._count.products} products</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}