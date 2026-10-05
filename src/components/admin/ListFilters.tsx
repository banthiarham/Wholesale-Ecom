"use client"

import { useState } from "react"
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, X } from "lucide-react"

/* Generic admin filter + sort bar (Filters button with a panel, sort dropdown, removable chips).
   Pages own the data and the filtering logic; this only edits the values. */

export type FilterOption = { value: string; label: string }

export type FilterField =
  | { type: "number"; key: string; label: string; placeholder?: string; hint?: string }
  | { type: "multi"; key: string; label: string; options: FilterOption[] }
  | { type: "select"; key: string; label: string; options: FilterOption[]; allLabel?: string }

export type FilterValues = Record<string, string | string[]>

export function emptyValues(fields: FilterField[]): FilterValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "multi" ? [] : ""]))
}

const isActive = (f: FilterField, v: FilterValues) => (f.type === "multi" ? (v[f.key] as string[]).length > 0 : String(v[f.key] ?? "") !== "")

export function countActive(fields: FilterField[], v: FilterValues) {
  return fields.filter((f) => isActive(f, v)).length
}

interface Props {
  fields: FilterField[]
  values: FilterValues
  onValues: (v: FilterValues) => void
  sort?: string
  sortOptions?: FilterOption[]
  onSort?: (s: string) => void
  resultCount: number
  totalCount: number
  noun: string
}

const control = "px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"

export function ListFilterBar({ fields, values, onValues, sort, sortOptions, onSort, resultCount, totalCount, noun }: Props) {
  const [open, setOpen] = useState(false)
  const active = countActive(fields, values)
  const set = (key: string, v: string | string[]) => onValues({ ...values, [key]: v })
  const reset = () => onValues(emptyValues(fields))

  const chips = fields.flatMap((f) => {
    if (!isActive(f, values)) return []
    if (f.type === "multi") {
      const sel = values[f.key] as string[]
      return [{ key: f.key, label: `${f.label}: ${sel.map((s) => f.options.find((o) => o.value === s)?.label ?? s).join(", ")}`, clear: () => set(f.key, []) }]
    }
    if (f.type === "select") {
      const v = String(values[f.key])
      return [{ key: f.key, label: `${f.label}: ${f.options.find((o) => o.value === v)?.label ?? v}`, clear: () => set(f.key, "") }]
    }
    return [{ key: f.key, label: `${f.label}: ≥ ${values[f.key]}`, clear: () => set(f.key, "") }]
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-2 px-3.5 py-2 border bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition ${active ? "border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400" : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"}`}
        >
          <SlidersHorizontal size={16} /> Filters
          {active > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary-600 text-white text-xs font-semibold flex items-center justify-center">{active}</span>}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {sortOptions && onSort && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <ArrowUpDown size={16} className="text-gray-400" />
            <span className="sr-only sm:not-sr-only">Sort by</span>
            <select value={sort} onChange={(e) => onSort(e.target.value)} className={control}>
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {resultCount === totalCount ? `${totalCount} ${noun}` : `${resultCount} of ${totalCount} ${noun}`}
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
          <button type="button" onClick={reset} className="text-xs font-semibold text-gray-500 hover:text-primary-600 underline-offset-2 hover:underline">Clear all</button>
        </div>
      )}

      {open && (
        <div className="admin-card-static p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><SlidersHorizontal size={16} /> Filters</h3>
            <div className="flex items-center gap-3">
              <button type="button" onClick={reset} disabled={active === 0} className="text-sm text-gray-500 hover:text-primary-600 disabled:opacity-40 disabled:hover:text-gray-500">Reset</button>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Check size={14} /> Done</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
            {fields.map((f) => (
              <div key={f.key}>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2.5">{f.label}</h4>
                {f.type === "number" && (
                  <>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={String(values[f.key] ?? "")}
                      placeholder={f.placeholder ?? "Enter a number"}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={`${control} w-full`}
                    />
                    {f.hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{f.hint}</p>}
                  </>
                )}
                {f.type === "select" && (
                  <select value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className={`${control} w-full`}>
                    <option value="">{f.allLabel ?? "All"}</option>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {f.type === "multi" && (
                  <div className="space-y-1.5">
                    {f.options.map((o) => {
                      const sel = values[f.key] as string[]
                      const checked = sel.includes(o.value)
                      return (
                        <label key={o.value} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox" checked={checked}
                            onChange={() => set(f.key, checked ? sel.filter((s) => s !== o.value) : [...sel, o.value])}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          {o.label}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
