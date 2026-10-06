"use client"

import { SlidersHorizontal, X } from "lucide-react"
import { ProductFilterFields, ProductFilterState, countActiveFilters, defaultFilters } from "@/components/admin/ProductFilters"

interface Props {
  open: boolean
  onClose: () => void
  filters: ProductFilterState
  onFilters: (f: ProductFilterState) => void
  categories: { id: string; name: string }[]
  companies: string[]
  resultCount: number
}

/** Storefront filters: one compact horizontal box under the page header (opened by the Filters button). Filters apply instantly. */
export function ProductFilterPanel({ open, onClose, filters, onFilters, categories, companies, resultCount }: Props) {
  if (!open) return null
  const active = countActiveFilters(filters, true)
  return (
    <section aria-label="Filters" className="card-base-static p-3.5 sm:p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-primary-600" />
          <h3 className="text-sm font-bold text-gray-900">Filters</h3>
          {active > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-semibold flex items-center justify-center">{active}</span>}
          <span className="text-xs text-gray-500">{resultCount} product{resultCount === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onFilters(defaultFilters)} disabled={active === 0} className="text-xs font-semibold text-gray-500 hover:text-primary-600 disabled:opacity-40 disabled:hover:text-gray-500">Clear all</button>
          <button type="button" onClick={onClose} aria-label="Close filters" className="p-1 rounded-md hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
      </div>
      <ProductFilterFields filters={filters} onFilters={onFilters} categories={categories} companies={companies} />
    </section>
  )
}
