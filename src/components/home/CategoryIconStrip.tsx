"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Category {
  id: string
  name: string
  handle: string
  image: string | null
  _count?: { products: number }
  children?: Category[]
}

const CATEGORY_ICONS: Record<string, string> = {
  electronics: "🔌", furniture: "🪑", fashion: "👗", food: "🍽️", industrial: "🏭",
  office: "📁", health: "💊", sports: "⚽", beauty: "💄", toys: "🧸",
  books: "📚", auto: "🚗", garden: "🌱", pet: "🐾", music: "🎵",
}

const FALLBACK_COLORS = [
  "from-blue-500 to-blue-600", "from-purple-500 to-purple-600", "from-green-500 to-green-600",
  "from-orange-500 to-orange-600", "from-pink-500 to-pink-600", "from-cyan-500 to-cyan-600",
  "from-red-500 to-red-600", "from-yellow-500 to-yellow-600", "from-indigo-500 to-indigo-600",
  "from-teal-500 to-teal-600", "from-rose-500 to-rose-600", "from-amber-500 to-amber-600",
]

export default function CategoryIconStrip() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const cats: Category[] = []
        const walk = (arr: any[]) => { for (const c of arr || []) { cats.push(c); walk(c.children) } }
        walk(data.categories || [])
        setCategories(cats.filter((c) => c.image || true).slice(0, 12))
      })
      .catch(() => {})
  }, [])

  if (categories.length === 0) return null

  return (
    <section className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat, i) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.handle}`}
              className="flex flex-col items-center gap-2 min-w-[80px] group"
            >
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${FALLBACK_COLORS[i % FALLBACK_COLORS.length]} flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-105 transition-transform shadow-sm`}>
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                ) : (
                  <span>{CATEGORY_ICONS[cat.handle] || CATEGORY_ICONS[cat.name.toLowerCase()] || "📦"}</span>
                )}
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-primary-600 transition text-center leading-tight">{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}