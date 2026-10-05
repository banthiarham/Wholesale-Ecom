"use client"

import { useEffect } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { ProductFilterState, RangeFilter, RatingFilter, PRICE_MAX, STOCK_MAX, countActiveFilters, defaultFilters } from "@/components/admin/ProductFilters"

interface Props {
  open: boolean
  onClose: () => void
  filters: ProductFilterState
  onFilters: (f: ProductFilterState) => void
  categories: { id: string; name: string }[]
  resultCount: number
}

/** Storefront filter dialog: category, price range, stock level and star rating. Filters apply instantly. */
export function ProductFilterPopup({ open, onClose, filters, onFilters, categories, resultCount }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null
  const set = (patch: Partial<ProductFilterState>) => onFilters({ ...filters, ...patch })
  const active = countActiveFilters(filters, true)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:p-4 sm:pt-24" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-[var(--shadow-elevated)] flex flex-col max-h-[90vh] sm:max-h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-primary-600" />
            <h3 className="heading-sm">Filters</h3>
            {active > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary-600 text-white text-xs font-semibold flex items-center justify-center">{active}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition" aria-label="Close filters"><X size={18} /></button>
        </div>

        <div className="px-5 py-5 space-y-7 overflow-y-auto">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Category</h4>
            <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className="input-base">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <RangeFilter label="Price Range" prefix="₹" max={PRICE_MAX} step={50} value={[filters.priceMin, filters.priceMax]} onChange={([a, b]) => set({ priceMin: a, priceMax: b })} />
          <RangeFilter label="Stock Level" unit="units" max={STOCK_MAX} step={5} value={[filters.stockMin, filters.stockMax]} onChange={([a, b]) => set({ stockMin: a, stockMax: b })} />
          <RatingFilter value={filters.rating} onChange={(rating) => set({ rating })} />
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
          <button onClick={() => onFilters(defaultFilters)} disabled={active === 0} className="btn-outline flex-1 disabled:opacity-40">Clear All</button>
          <button onClick={onClose} className="btn-primary flex-[2]">Show {resultCount} product{resultCount === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  )
}
