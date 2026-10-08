"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"

export interface CategoryOption {
  id: string
  name: string
}

interface Props {
  options: CategoryOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

/**
 * Dropdown that lets the admin tick several categories. Selected ones show as removable chips
 * under the field. The first one picked is the product's primary category.
 */
export default function CategoryDropdown({ options, selectedIds, onChange, placeholder = "Select categories" }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
  }, [options, query])

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span className={selectedIds.length === 0 ? "text-gray-400 dark:text-gray-500" : ""}>
          {selectedIds.length === 0 ? placeholder : `${selectedIds.length} categor${selectedIds.length === 1 ? "y" : "ies"} selected`}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-center text-gray-500 dark:text-gray-400">No categories found</li>}
            {filtered.map((o) => {
              const checked = selectedIds.includes(o.id)
              return (
                <li key={o.id} role="option" aria-selected={checked}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "bg-primary-600 border-primary-600 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                      {checked && <Check size={12} />}
                    </span>
                    <span className="truncate">{o.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-3 py-2 text-xs">
            <button type="button" onClick={() => onChange([])} disabled={selectedIds.length === 0} className="text-gray-500 hover:text-red-500 disabled:opacity-40">Clear all</button>
            <button type="button" onClick={() => setOpen(false)} className="font-medium text-primary-600 dark:text-primary-400">Done</button>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedIds.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
              {byId.get(id)?.name || "Unknown category"}
              {i === 0 && selectedIds.length > 1 && <span className="opacity-60">(primary)</span>}
              <button type="button" aria-label="Remove category" onClick={() => toggle(id)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
