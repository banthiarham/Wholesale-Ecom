"use client"

import { useState, useRef, useEffect } from "react"
import { Search, X, ChevronDown } from "lucide-react"

export interface SelectOption {
  value: string
  label: string
  subtitle?: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  className = "",
  disabled = false,
  required = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) => {
    const q = search.toLowerCase()
    return o.label.toLowerCase().includes(q) || (o.subtitle && o.subtitle.toLowerCase().includes(q))
  })

  return (
    <div className={`relative ${className}`} ref={ref}>
      {required && <input type="text" value={value} required className="sr-only" tabIndex={-1} onChange={() => {}} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${!selected ? "text-gray-400 dark:text-gray-500" : ""}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">{emptyText}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                    setSearch("")
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30 transition flex items-center justify-between gap-2 ${
                    opt.value === value ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="truncate font-medium">{opt.label}</span>
                  {opt.subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{opt.subtitle}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}