"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Cpu, Shirt, Wrench, Package, Sparkles, Utensils, Heart, BookOpen, Dumbbell, Paintbrush } from "lucide-react"

interface Category {
  id: string
  name: string
  handle: string
  description: string | null
  image: string | null
  children: Category[]
  _count?: { products: number }
}

const categoryMeta: Record<string, { icon: any; gradient: string; accent: string }> = {
  electronics: { icon: Cpu, gradient: "from-blue-600 to-cyan-500", accent: "bg-blue-500/20" },
  fashion: { icon: Shirt, gradient: "from-pink-500 to-rose-400", accent: "bg-pink-500/20" },
  industrial: { icon: Wrench, gradient: "from-amber-600 to-orange-500", accent: "bg-amber-500/20" },
  "home-kitchen": { icon: Utensils, gradient: "from-green-600 to-emerald-500", accent: "bg-green-500/20" },
  "health-beauty": { icon: Sparkles, gradient: "from-purple-500 to-pink-400", accent: "bg-purple-500/20" },
  food: { icon: Utensils, gradient: "from-green-600 to-emerald-500", accent: "bg-green-500/20" },
  health: { icon: Heart, gradient: "from-red-500 to-pink-500", accent: "bg-red-500/20" },
  books: { icon: BookOpen, gradient: "from-indigo-600 to-violet-500", accent: "bg-indigo-500/20" },
  sports: { icon: Dumbbell, gradient: "from-teal-500 to-cyan-500", accent: "bg-teal-500/20" },
  art: { icon: Paintbrush, gradient: "from-fuchsia-500 to-purple-500", accent: "bg-fuchsia-500/20" },
  beauty: { icon: Sparkles, gradient: "from-purple-500 to-pink-400", accent: "bg-purple-500/20" },
}

const defaultMeta = { icon: Package, gradient: "from-gray-600 to-slate-500", accent: "bg-gray-500/20" }

function getMeta(handle: string) {
  return categoryMeta[handle.toLowerCase()] || defaultMeta
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
      {categories.map((category) => {
        const meta = getMeta(category.handle)
        const Icon = meta.icon
        const productCount = category._count?.products || 0

        return (
          <Link
            key={category.id}
            href={`/categories/${category.handle}`}
            className="group relative rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {/* Card body */}
            <div className={`relative h-52 bg-gradient-to-br ${meta.gradient} p-6 flex flex-col justify-between`}>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

              {/* Top row: icon + product count */}
              <div className="relative flex items-start justify-between">
                <div className={`w-14 h-14 ${meta.accent} backdrop-blur-sm rounded-2xl flex items-center justify-center`}>
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <Icon size={26} className="text-white" />
                  )}
                </div>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
                  {productCount} {productCount === 1 ? "Product" : "Products"}
                </span>
              </div>

              {/* Bottom: name + description */}
              <div className="relative">
                <h3 className="text-xl font-bold text-white mb-1">{category.name}</h3>
                {category.description && (
                  <p className="text-sm text-white/70 line-clamp-2">{category.description}</p>
                )}
              </div>
            </div>

            {/* Footer strip */}
            <div className="bg-white px-6 py-3.5 flex items-center justify-between group-hover:bg-gray-50 transition">
              <span className="text-sm font-medium text-gray-500 group-hover:text-primary-600 transition">
                Browse collection
              </span>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
            </div>

            {/* Sub-categories */}
            {category.children.length > 0 && (
              <div className="absolute bottom-14 left-6 right-6 flex flex-wrap gap-1.5">
                {category.children.slice(0, 3).map((child) => (
                  <span key={child.id} className="text-[11px] px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium">
                    {child.name}
                  </span>
                ))}
                {category.children.length > 3 && (
                  <span className="text-[11px] px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium">
                    +{category.children.length - 3} more
                  </span>
                )}
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}