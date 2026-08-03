"use client"

import { Search, SlidersHorizontal, Grid3X3, List, ArrowUpDown } from "lucide-react"

export type SortOption = "newest" | "price_asc" | "price_desc" | "rating" | "name"
export type ViewMode = "grid" | "list"

interface ListingToolbarProps {
  resultCount: number
  resultLabel?: string
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  searchPlaceholder?: string
  sort: SortOption
  onSortChange: (sort: SortOption) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  hasActiveFilters: boolean
  onToggleMobileFilters: () => void
}

/**
 * Sticky search/sort/view toolbar shared by the product listing and category
 * pages. Purely presentational — the caller owns all state and data-fetching;
 * this only reports intent (onSearchChange/onSearchSubmit/onSortChange/etc).
 * The filter-toggle button only shows below `lg` since desktop shows the
 * FilterSidebar as a permanent rail instead.
 */
export function ListingToolbar({
  resultCount,
  resultLabel = "products found",
  search,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = "Search products...",
  sort,
  onSortChange,
  view,
  onViewChange,
  hasActiveFilters,
  onToggleMobileFilters,
}: ListingToolbarProps) {
  return (
    <div className="sticky-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="body-sm shrink-0">{resultCount} {resultLabel}</p>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
        {/* Sort */}
        <div className="relative hidden sm:block">
          <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="pl-8 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating">Top Rated</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        {/* Mobile filter toggle — desktop uses the permanent FilterSidebar rail instead */}
        <button
          onClick={onToggleMobileFilters}
          className={`lg:hidden p-2.5 rounded-xl border transition-all ${
            hasActiveFilters ? "border-primary-300 text-primary-600 bg-primary-50" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
        {/* View toggle */}
        <div className="hidden sm:flex border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => onViewChange("grid")} className={`p-2.5 transition-all ${view === "grid" ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-gray-600"}`}>
            <Grid3X3 size={18} />
          </button>
          <button onClick={() => onViewChange("list")} className={`p-2.5 transition-all ${view === "list" ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-gray-600"}`}>
            <List size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
