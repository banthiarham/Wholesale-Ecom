"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ChevronRight, Cpu, Shirt, Wrench, Package, Sparkles, Utensils, Heart, BookOpen, Dumbbell, Paintbrush,
  Search, SlidersHorizontal, ArrowUpDown, Grid3X3, List, X,
} from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import { useCategories, type CategoryNode } from "@/lib/categories/CategoriesProvider"
import { useInfiniteScroll, ScrollSentinel } from "@/lib/useInfiniteScroll"

// Icon shown when a category has no image (matched by handle, falls back to a box).
const categoryIcons: Record<string, any> = {
  electronics: Cpu, fashion: Shirt, industrial: Wrench, "home-kitchen": Utensils, "health-beauty": Sparkles,
  food: Utensils, health: Heart, books: BookOpen, sports: Dumbbell, art: Paintbrush, beauty: Sparkles,
}

// Soft pastel backdrops that cycle across the cards, like the reference design.
const TINTS = ["bg-sky-100", "bg-violet-100", "bg-emerald-100", "bg-amber-100", "bg-rose-100"]

type SortKey = "newest" | "name" | "products"
type ViewMode = "grid" | "list"
const BATCH_SIZE = 20

function CategoryVisual({ cat, tint, size }: { cat: CategoryNode; tint: string; size: "card" | "row" }) {
  const Icon = categoryIcons[cat.handle.toLowerCase()] || Package
  const count = cat._count?.products ?? 0
  return (
    <div className={`relative overflow-hidden ${tint} ${size === "card" ? "h-40 sm:h-44" : "h-28 w-28 sm:w-36 shrink-0"} flex items-center justify-center`}>
      {cat.image ? (
        <Image src={cat.image} alt={cat.name} fill className="object-contain p-5 transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 20vw" />
      ) : (
        <Icon size={size === "card" ? 56 : 40} className="text-gray-900/15 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
      )}
      <span className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/85 flex items-center justify-center shadow-sm">
        <Package size={16} className="text-primary-600" />
      </span>
      {size === "card" && (
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 text-[11px] font-semibold text-gray-700 shadow-sm">
          {count} {count === 1 ? "Product" : "Products"}
        </span>
      )}
    </div>
  )
}

export default function CategoriesPage() {
  const { categories, loaded, error } = useCategories()
  const loading = !loaded
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("newest")
  const [view, setView] = useState<ViewMode>("grid")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ onlyWithProducts: false, minProducts: "" })
  const [draft, setDraft] = useState(filters)

  const hasActiveFilters = filters.onlyWithProducts || !!filters.minProducts
  const totalProducts = categories.reduce((sum, c) => sum + (c._count?.products || 0), 0)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = categories.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)))) return false
      const n = c._count?.products ?? 0
      if (filters.onlyWithProducts && n === 0) return false
      if (filters.minProducts && n < Number(filters.minProducts)) return false
      return true
    })
    list = [...list]
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === "products") list.sort((a, b) => (b._count?.products ?? 0) - (a._count?.products ?? 0))
    else list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    return list
  }, [categories, search, sort, filters])

  // No pagination: the list scrolls and reveals 20 more categories at a time.
  const { visibleCount, hasMore, sentinelRef } = useInfiniteScroll(visible.length, visible, BATCH_SIZE)
  const shown = visible.slice(0, visibleCount)

  // Esc closes the filter popup
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [filtersOpen])

  const openFilters = () => { setDraft(filters); setFiltersOpen(true) }
  const applyFilters = () => { setFilters(draft); setFiltersOpen(false) }
  const clearFilters = () => { const r = { onlyWithProducts: false, minProducts: "" }; setDraft(r); setFilters(r); setFiltersOpen(false) }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        {/* Header: title left; Filters button, search, sort and view toggle right */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="heading-lg">Shop by Category</h1>
            <p className="body-sm mt-1">Browse {totalProducts} products across {categories.length} categories</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openFilters}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shrink-0 ${
                hasActiveFilters ? "border-primary-400 text-primary-700 bg-primary-50" : "border-primary-200 text-primary-700 bg-white hover:bg-primary-50"
              }`}
            >
              <SlidersHorizontal size={16} /> Filters
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-600" aria-label="Filters applied" />}
            </button>
            <div className="relative flex-1 sm:flex-initial">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-full sm:w-56 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort categories"
                className="pl-8 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="newest">Newest</option>
                <option value="name">Name A–Z</option>
                <option value="products">Most products</option>
              </select>
            </div>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button onClick={() => setView("grid")} aria-label="Grid view" className={`p-2.5 transition-all ${view === "grid" ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-gray-600"}`}><Grid3X3 size={18} /></button>
              <button onClick={() => setView("list")} aria-label="List view" className={`p-2.5 transition-all ${view === "list" ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-gray-600"}`}><List size={18} /></button>
            </div>
          </div>
        </div>

        {/* Filters popup */}
        {filtersOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24 sm:pt-28" role="dialog" aria-modal="true" aria-label="Category filters">
            <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
            <div className="relative w-full max-w-sm card-base-static p-5 shadow-[var(--shadow-elevated)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-primary-600" /><h3 className="heading-sm">Filters</h3></div>
                <button onClick={() => setFiltersOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition" aria-label="Close filters"><X size={18} /></button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="body-sm font-medium text-gray-700 mb-1.5 block">Minimum products in category</label>
                  <input type="number" min={0} value={draft.minProducts} onChange={(e) => setDraft({ ...draft, minProducts: e.target.value })} className="input-base" placeholder="e.g. 10" />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={draft.onlyWithProducts} onChange={(e) => setDraft({ ...draft, onlyWithProducts: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="body-sm">Only categories that have products</span>
                </label>
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <button onClick={applyFilters} className="btn-primary w-full">Apply Filters</button>
                  {(hasActiveFilters || draft.onlyWithProducts || draft.minProducts) && <button onClick={clearFilters} className="btn-outline w-full">Clear All</button>}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : error ? (
          <EmptyState icon={Package} title="Couldn't load categories" description="Something went wrong while fetching categories. Please try again." action={{ label: "Retry", onClick: () => window.location.reload() }} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={search || hasActiveFilters ? "No categories match your search" : "No categories available"}
            action={search || hasActiveFilters ? { label: "Clear search & filters", onClick: () => { setSearch(""); clearFilters() } } : undefined}
          />
        ) : (
          <>
            {view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {shown.map((cat, i) => (
                  <Link key={cat.id} href={`/categories/${cat.handle}`} className="card-base group block overflow-hidden">
                    <CategoryVisual cat={cat} tint={TINTS[i % TINTS.length]} size="card" />
                    <div className="p-4">
                      <h3 className="text-sm sm:text-[15px] font-bold uppercase tracking-wide text-gray-900 line-clamp-2 min-h-[2.5rem]">{cat.name}</h3>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary-600">Browse Collection</span>
                        <ChevronRight size={16} className="text-primary-600 transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {shown.map((cat, i) => {
                  const n = cat._count?.products ?? 0
                  return (
                    <Link key={cat.id} href={`/categories/${cat.handle}`} className="card-base group flex overflow-hidden">
                      <CategoryVisual cat={cat} tint={TINTS[i % TINTS.length]} size="row" />
                      <div className="flex-1 min-w-0 p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold uppercase tracking-wide text-gray-900">{cat.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{n} {n === 1 ? "Product" : "Products"}</p>
                          {cat.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1 hidden sm:block">{cat.description}</p>}
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                          <span className="hidden sm:inline">Browse Collection</span> <ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
            <ScrollSentinel hasMore={hasMore} sentinelRef={sentinelRef} />
          </>
        )}
      </main>
    </div>
  )
}
