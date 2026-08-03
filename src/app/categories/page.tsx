"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Cpu,
  Shirt,
  Wrench,
  Package,
  Sparkles,
  Utensils,
  Heart,
  BookOpen,
  Dumbbell,
  Paintbrush,
  Search,
} from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import Image from "next/image"
import { useCategories } from "@/lib/categories/CategoriesProvider"

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

export default function CategoriesPage() {
  const { categories, loaded, error } = useCategories()
  const loading = !loaded
  const [search, setSearch] = useState("")

  const filtered = search.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
      )
    : categories

  const totalProducts = categories.reduce((sum, c) => sum + (c._count?.products || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-10">
        {/* Page header */}
        <div className="mb-10">
          <span className="eyebrow">Browse</span>
          <h1 className="heading-xl mb-2">Shop by Category</h1>
          <p className="body-lg">Browse {totalProducts} products across {categories.length} categories</p>
        </div>

        {/* Search / Filter bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 lg:h-60 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Package}
            title="Couldn't load categories"
            description="Something went wrong while fetching categories. Please try again."
            action={{ label: "Retry", onClick: () => window.location.reload() }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={search ? "No categories match your search" : "No categories available"}
            action={search ? { label: "Clear search", onClick: () => setSearch("") } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((cat) => {
              const meta = getMeta(cat.handle)
              const Icon = meta.icon
              const productCount = cat._count?.products || 0

              return (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.handle}`}
                  className="card-base group relative overflow-hidden block"
                >
                  {/* Card body */}
                  <div className={`relative h-56 lg:h-60 bg-gradient-to-br ${meta.gradient} p-6 flex flex-col justify-between overflow-hidden`}>
                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

                    {/* Top row: icon + product count */}
                    <div className="relative flex items-start justify-between">
                      <div className={`relative w-14 h-14 ${meta.accent} backdrop-blur-sm rounded-2xl flex items-center justify-center overflow-hidden`}>
                        {cat.image ? (
                          <Image src={cat.image} alt={cat.name} fill className="img-zoom object-cover" sizes="56px" />
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
                      <h3 className="text-xl lg:text-2xl font-bold text-white mb-1 tracking-tight">{cat.name}</h3>
                      {cat.description && (
                        <p className="text-sm text-white/70 line-clamp-2">{cat.description}</p>
                      )}
                    </div>

                    {/* Sub-categories */}
                    {cat.children && cat.children.length > 0 && (
                      <div className="absolute bottom-16 left-6 right-6 flex flex-wrap gap-1.5">
                        {cat.children.slice(0, 3).map((child) => (
                          <span key={child.id} className="text-[11px] px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium">
                            {child.name}
                          </span>
                        ))}
                        {cat.children.length > 3 && (
                          <span className="text-[11px] px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium">
                            +{cat.children.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer strip */}
                  <div className="bg-white px-6 py-4 flex items-center justify-between group-hover:bg-gray-50 transition-colors duration-200">
                    <span className="text-sm font-semibold text-gray-600 group-hover:text-primary-600 transition-colors">
                      Browse collection
                    </span>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-600 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}