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
  /** Show a labelled "Filters" button (left of the search box) at every screen size. */
  filterButton?: boolean
  /** Set false when the caller renders the result count itself. */
  showResultCount?: boolean
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
  filterButton = false,
  showResultCount = true,
}: ListingToolbarProps) {
  return (
    <div className={filterButton ? "flex flex-col sm:flex-row sm:items-center justify-end gap-3" : "sticky-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3"}>
      {showResultCount && <p className="body-sm shrink-0">{resultCount} {resultLabel}</p>}
      <div className="flex items-center gap-2 sm:gap-3">
        {filterButton && (
          <button
            type="button"
            onClick={onToggleMobileFilters}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shrink-0 ${
              hasActiveFilters ? "border-primary-400 text-primary-700 bg-primary-50" : "border-primary-200 text-primary-700 bg-white hover:bg-primary-50"
            }`}
          >
            <SlidersHorizontal size={16} /> Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-600" aria-label="Filters applied" />}
          </button>
        )}
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
          className={`${filterButton ? "hidden" : "lg:hidden"} p-2.5 rounded-xl border transition-all ${
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
