"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, Star, X } from "lucide-react"

/* ── Shared admin filter + sort for product lists ── */

export const PRICE_MAX = 5000
export const STOCK_MAX = 300
/** Size filter runs 0 – 1 TB (stored in GB); the top end means "1 TB and above". */
export const SIZE_MAX = 1024
/** How far either side of the chosen star count a product's rating may be (3★ → 2.7 – 3.3). */
export const RATING_TOLERANCE = 0.3

export type SortKey = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc"

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Recommended" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
]

export interface ProductFilterState {
  categoryId: string
  priceMin: number
  priceMax: number // PRICE_MAX means "5000+" (no upper limit)
  stockMin: number
  stockMax: number // STOCK_MAX means "300+" (no upper limit)
  rating: number // 0 = any
  company: string // "" = all companies
  sizeMin: number // GB
  sizeMax: number // SIZE_MAX means "1 TB+" (no upper limit)
}

export const defaultFilters: ProductFilterState = { categoryId: "", priceMin: 0, priceMax: PRICE_MAX, stockMin: 0, stockMax: STOCK_MAX, rating: 0, company: "", sizeMin: 0, sizeMax: SIZE_MAX }

interface Filterable {
  title: string
  unitPrice: number | string
  inventoryQuantity: number
  reservedQuantity?: number
  categoryId?: string | null
  rating?: number | string | null
  companyName?: string | null
  sizeGb?: number | string | null
}

/** Every company name entered on any product, sorted (case-insensitive duplicates merged). */
export function uniqueCompanies(list: { companyName?: string | null }[]): string[] {
  const seen = new Map<string, string>()
  for (const p of list) {
    const name = (p.companyName || "").trim()
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

/** 24 → "24 GB", 1024 → "1 TB". */
export function formatSize(gb: number): string {
  if (gb >= 1024) return `${+(gb / 1024).toFixed(2)} TB`
  return `${gb} GB`
}

const sizeActive = (f: ProductFilterState) => f.sizeMin > 0 || f.sizeMax < SIZE_MAX

const availableStock = (p: Filterable) => p.inventoryQuantity - (p.reservedQuantity || 0)

export function countActiveFilters(f: ProductFilterState, showCategory: boolean) {
  return (
    (showCategory && f.categoryId ? 1 : 0) +
    (f.priceMin > 0 || f.priceMax < PRICE_MAX ? 1 : 0) +
    (f.stockMin > 0 || f.stockMax < STOCK_MAX ? 1 : 0) +
    (f.company ? 1 : 0) +
    (sizeActive(f) ? 1 : 0) +
    (f.rating > 0 ? 1 : 0)
  )
}

export function applyProductFilters<T extends Filterable>(list: T[], f: ProductFilterState, sort: SortKey): T[] {
  const out = list.filter((p) => {
    const price = Number(p.unitPrice)
    if (f.categoryId && p.categoryId !== f.categoryId) return false
    if (price < f.priceMin || (f.priceMax < PRICE_MAX && price > f.priceMax)) return false
    const stock = availableStock(p)
    if (stock < f.stockMin || (f.stockMax < STOCK_MAX && stock > f.stockMax)) return false
    if (f.company && (p.companyName || "").trim().toLowerCase() !== f.company.trim().toLowerCase()) return false
    if (sizeActive(f)) {
      // Products with no size entered can't match a size range.
      if (p.sizeGb == null || p.sizeGb === "") return false
      const size = Number(p.sizeGb)
      if (size < f.sizeMin || (f.sizeMax < SIZE_MAX && size > f.sizeMax)) return false
    }
    if (f.rating > 0) {
      const r = Number(p.rating ?? 0)
      if (r < f.rating - RATING_TOLERANCE - 1e-9 || r > f.rating + RATING_TOLERANCE + 1e-9) return false
    }
    return true
  })
  if (sort === "default") return out
  const sorted = [...out]
  const byName = (a: T, b: T) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  if (sort === "price-asc") sorted.sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice))
  else if (sort === "price-desc") sorted.sort((a, b) => Number(b.unitPrice) - Number(a.unitPrice))
  else if (sort === "name-asc") sorted.sort(byName)
  else if (sort === "name-desc") sorted.sort((a, b) => byName(b, a))
  return sorted
}

/* Number input that keeps what you type until you leave the field (or press Enter),
   so a half-typed value is never clamped or overwritten mid-keystroke. */
function NumberField({ label, value, emptyValue, prefix, placeholder, onCommit }: { label: string; value: number | null; emptyValue: number; prefix?: string; placeholder: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const t = draft.trim()
    const n = t === "" ? emptyValue : Number(t)
    if (Number.isFinite(n)) onCommit(Math.max(0, Math.round(n)))
    setDraft(null)
  }
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
      <input
        type="number" inputMode="numeric" min={0}
        value={draft ?? (value === null ? "" : String(value))}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit() } }}
        className={`w-full ${prefix ? "pl-7" : "pl-3"} pr-1.5 py-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary-500`}
      />
    </label>
  )
}

/* ── Dual-handle range slider with manual inputs ── */
const RANGE_CSS = `
        .range-thumb{position:absolute;left:0;top:0;width:100%;height:100%;margin:0;background:transparent;pointer-events:none;-webkit-appearance:none;appearance:none}
        .range-thumb::-webkit-slider-runnable-track{-webkit-appearance:none;background:transparent;height:100%}
        .range-thumb::-moz-range-track{background:transparent;height:100%}
        .range-thumb::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:16px;height:16px;border-radius:9999px;background:#fff;border:2px solid rgb(var(--color-primary-600));box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:grab;margin-top:4px}
        .range-thumb::-moz-range-thumb{pointer-events:auto;width:12px;height:12px;border-radius:9999px;background:#fff;border:2px solid rgb(var(--color-primary-600));box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:grab}
        .range-thumb:focus-visible::-webkit-slider-thumb{outline:2px solid rgb(var(--color-primary-400));outline-offset:2px}
      `

export function RangeFilter({
  label, max, step, value, onChange, prefix = "", unit, format, maxPlaceholder,
}: { label: string; max: number; step: number; value: [number, number]; onChange: (v: [number, number]) => void; prefix?: string; unit?: string; format?: (n: number) => string; maxPlaceholder?: string }) {
  const [lo, hi] = value
  const pct = (n: number) => (n / max) * 100
  const setLo = (n: number) => onChange([Math.max(0, Math.min(n, hi)), hi])
  const setHi = (n: number) => onChange([lo, Math.min(max, Math.max(n, lo))])
  return (
    <div>
      <style>{RANGE_CSS}</style>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{label}</h4>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{format ? `${format(lo)} – ${format(hi)}${hi >= max ? "+" : ""}` : `${prefix}${lo} – ${prefix}${hi}${hi >= max ? "+" : ""}${unit ? ` ${unit}` : ""}`}</span>
      </div>
      <div className="relative h-5 mx-1.5">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-primary-600" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" className="range-thumb" min={0} max={max} step={step} value={lo} aria-label={`${label} minimum`} onChange={(e) => setLo(Number(e.target.value))} style={{ zIndex: lo > max - step * 2 ? 5 : 3 }} />
        <input type="range" className="range-thumb" min={0} max={max} step={step} value={hi} aria-label={`${label} maximum`} onChange={(e) => setHi(Number(e.target.value))} style={{ zIndex: 4 }} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <NumberField label="Minimum" value={lo} emptyValue={0} prefix={prefix} placeholder="Min" onCommit={(n) => onChange([Math.min(n, hi), hi])} />
        <NumberField label="Maximum" value={hi >= max ? null : hi} emptyValue={max} prefix={prefix} placeholder={maxPlaceholder ?? `${max}+`} onCommit={(n) => onChange([lo, Math.min(max, Math.max(n, lo))])} />
      </div>
    </div>
  )
}

/* ── Star-rating checkbox row ── */
export function RatingFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Customer Rating</h4>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {value ? `${(value - RATING_TOLERANCE).toFixed(1)} – ${(value + RATING_TOLERANCE).toFixed(1)} stars` : "Any rating"}
        </span>
      </div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
            <input type="checkbox" className="sr-only peer" checked={value === n} onChange={() => onChange(value === n ? 0 : n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} />
            <Star size={22} className={`transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 rounded ${n <= shown ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`} />
          </label>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
        {value ? "Click the same star again to clear." : "Click a star to filter by rating."}
      </p>
    </div>
  )
}

const selectCls = "w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"

/** All product filters in one compact grid — used by the admin bar and the storefront's horizontal filter box. */
export function ProductFilterFields({
  filters, onFilters, categories = [], companies = [], showCategory = true, className = "",
}: { filters: ProductFilterState; onFilters: (f: ProductFilterState) => void; categories?: { id: string; name: string }[]; companies?: string[]; showCategory?: boolean; className?: string }) {
  const set = (patch: Partial<ProductFilterState>) => onFilters({ ...filters, ...patch })
  return (
    <div className={className || `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-x-5 gap-y-4`}>
      {showCategory && (
        <div>
          <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-2">Category</h4>
          <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={selectCls}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-2">Company</h4>
        <select value={filters.company} onChange={(e) => set({ company: e.target.value })} className={selectCls} disabled={companies.length === 0}>
          <option value="">{companies.length === 0 ? "No companies yet" : "All companies"}</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <RangeFilter label="Price Range" prefix="₹" max={PRICE_MAX} step={50} value={[filters.priceMin, filters.priceMax]} onChange={([a, b]) => set({ priceMin: a, priceMax: b })} />
      <RangeFilter label="Size" max={SIZE_MAX} step={1} format={formatSize} maxPlaceholder="1 TB+" value={[filters.sizeMin, filters.sizeMax]} onChange={([a, b]) => set({ sizeMin: a, sizeMax: b })} />
      <RangeFilter label="Stock Level" unit="units" max={STOCK_MAX} step={5} value={[filters.stockMin, filters.stockMax]} onChange={([a, b]) => set({ stockMin: a, stockMax: b })} />
      <RatingFilter value={filters.rating} onChange={(rating) => set({ rating })} />
    </div>
  )
}

interface FilterBarProps {
  filters: ProductFilterState
  onFilters: (f: ProductFilterState) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  categories?: { id: string; name: string }[]
  /** Company names for the company filter (see uniqueCompanies). */
  companies?: string[]
  /** Hide the category filter (e.g. when already inside a single category). */
  showCategory?: boolean
  resultCount: number
  totalCount: number
}

export function ProductFilterBar({ filters, onFilters, sort, onSort, categories = [], companies = [], showCategory = true, resultCount, totalCount }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const active = countActiveFilters(filters, showCategory)
  const set = (patch: Partial<ProductFilterState>) => onFilters({ ...filters, ...patch })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const catName = categories.find((c) => c.id === filters.categoryId)?.name
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(showCategory && filters.categoryId ? [{ key: "cat", label: catName || "Category", clear: () => set({ categoryId: "" }) }] : []),
    ...(filters.priceMin > 0 || filters.priceMax < PRICE_MAX ? [{ key: "price", label: `Price: ₹${filters.priceMin} – ₹${filters.priceMax}${filters.priceMax >= PRICE_MAX ? "+" : ""}`, clear: () => set({ priceMin: 0, priceMax: PRICE_MAX }) }] : []),
    ...(filters.stockMin > 0 || filters.stockMax < STOCK_MAX ? [{ key: "stock", label: `Stock: ${filters.stockMin} – ${filters.stockMax}${filters.stockMax >= STOCK_MAX ? "+" : ""}`, clear: () => set({ stockMin: 0, stockMax: STOCK_MAX }) }] : []),
    ...(filters.company ? [{ key: "company", label: `Company: ${filters.company}`, clear: () => set({ company: "" }) }] : []),
    ...(filters.sizeMin > 0 || filters.sizeMax < SIZE_MAX ? [{ key: "size", label: `Size: ${formatSize(filters.sizeMin)} – ${formatSize(filters.sizeMax)}${filters.sizeMax >= SIZE_MAX ? "+" : ""}`, clear: () => set({ sizeMin: 0, sizeMax: SIZE_MAX }) }] : []),
    ...(filters.rating > 0 ? [{ key: "rating", label: `Rating: ${filters.rating}★ (${(filters.rating - RATING_TOLERANCE).toFixed(1)}–${(filters.rating + RATING_TOLERANCE).toFixed(1)})`, clear: () => set({ rating: 0 }) }] : []),
  ]

  const btn = "inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${btn} ${active ? "border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400" : ""}`}>
            <SlidersHorizontal size={16} /> Filters
            {active > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary-600 text-white text-xs font-semibold flex items-center justify-center">{active}</span>}
            <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <ArrowUpDown size={16} className="text-gray-400" />
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {resultCount === totalCount ? `${totalCount} products` : `${resultCount} of ${totalCount} products`}
        </span>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium">
              {c.label}
              <button type="button" onClick={c.clear} aria-label={`Remove ${c.key} filter`} className="w-4 h-4 rounded-full hover:bg-primary-100 dark:hover:bg-primary-800 flex items-center justify-center"><X size={11} /></button>
            </span>
          ))}
          <button type="button" onClick={() => onFilters(defaultFilters)} className="text-xs font-semibold text-gray-500 hover:text-primary-600 underline-offset-2 hover:underline">Clear all</button>
        </div>
      )}

      {open && (
        <div ref={panelRef} className="admin-card-static p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><SlidersHorizontal size={15} /> Filter products</h3>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => onFilters(defaultFilters)} disabled={active === 0} className="text-sm text-gray-500 hover:text-primary-600 disabled:opacity-40 disabled:hover:text-gray-500">Reset</button>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Check size={14} /> Done</button>
            </div>
          </div>
          <ProductFilterFields filters={filters} onFilters={onFilters} categories={categories} companies={companies} showCategory={showCategory} />
        </div>
      )}
    </div>
  )
}
