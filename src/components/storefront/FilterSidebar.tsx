"use client"

import { X, SlidersHorizontal } from "lucide-react"

export interface FilterValues {
  category?: string
  minPrice: string
  maxPrice: string
  inStock: boolean
}

interface FilterSidebarProps {
  filters: FilterValues
  onChange: (filters: FilterValues) => void
  onApply: () => void
  onClear: () => void
  hasActiveFilters: boolean
  categories?: { id: string; name: string }[]
  /** Mobile slide-over open state — desktop rendering ignores this and is always visible. */
  mobileOpen: boolean
  onMobileClose: () => void
}

/**
 * Presentational-only filter panel: same field markup renders as a permanent
 * sticky sidebar on desktop (lg+) and inside a slide-over drawer on mobile.
 * All data-fetching (loadProducts) stays with the caller — this component only
 * reports value changes via onChange and Apply/Clear intent via callbacks,
 * preserving the existing explicit "Apply Filters" flow rather than live-filtering.
 */
export function FilterSidebar({ filters, onChange, onApply, onClear, hasActiveFilters, categories, mobileOpen, onMobileClose }: FilterSidebarProps) {
  const fields = (
    <div className="space-y-5">
      {categories && (
        <div>
          <label className="body-sm font-medium text-gray-700 mb-1.5 block">Category</label>
          <select
            value={filters.category ?? ""}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            className="input-base"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="body-sm font-medium text-gray-700 mb-1.5 block">Price Range (₹)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.minPrice}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
            className="input-base"
            placeholder="Min"
          />
          <span className="text-gray-300 shrink-0">–</span>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
            className="input-base"
            placeholder="Max"
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.inStock}
          onChange={(e) => onChange({ ...filters, inStock: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="body-sm">In Stock Only</span>
      </label>

      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
        <button onClick={onApply} className="btn-primary w-full">Apply Filters</button>
        {hasActiveFilters && (
          <button onClick={onClear} className="btn-outline w-full">Clear All</button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sticky rail */}
      <aside className="hidden lg:block sticky-rail">
        <div className="card-base-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={16} className="text-primary-600" />
            <h3 className="heading-sm">Filters</h3>
          </div>
          {fields}
        </div>
      </aside>

      {/* Mobile slide-over */}
      <div className={`lg:hidden fixed inset-0 z-40 ${mobileOpen ? "" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={onMobileClose}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-[var(--shadow-elevated)] transition-transform duration-300 ease-out overflow-y-auto ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h3 className="heading-sm">Filters</h3>
            <button onClick={onMobileClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={18} /></button>
          </div>
          <div className="p-4">{fields}</div>
        </div>
      </div>
    </>
  )
}
