"use client"

import { useState } from "react"
import { Download, Upload, X } from "lucide-react"
import { saveAs } from "file-saver"

export interface BulkFilterOption { value: string; label: string }

interface Props {
  /** "export" downloads the CSV; "import" uploads an edited one. */
  mode: "export" | "import"
  /** "products" or "users" — drives the wording and the API paths. */
  entity: "products" | "users"
  /** Choices for the export filter (categories for products, roles for users); the first entry should be "all". */
  filterLabel?: string
  filterParam?: string
  filterOptions?: BulkFilterOption[]
  onClose: () => void
  /** Called after an upload that changed something, so the list behind the modal can refresh. */
  onApplied?: () => void
}

interface ImportResult { updated: number; variantsUpdated?: number; unchanged?: number; errors: string[] }

const COPY = {
  products: {
    noun: "products",
    exportHelp: "Downloads every product with all its details, tier prices, and a price and quantity column for each role.",
    columns: [
      "Don't change the ID column — it is how rows are matched.",
      "Leave a cell empty to keep the current value; type - to clear compare-at price, tier prices or a role price.",
      "Categories, tags and images are separated with |. Tier prices look like 10:95|50:90 (quantity:price).",
      "Each role has two columns: Role Price: <role> and Role Quantity: <role> (the minimum quantity for that price). Type - in the price to remove it.",
    ],
  },
  users: {
    noun: "users",
    exportHelp: "Downloads every user with their profile, company and tax details, role and status.",
    columns: [
      "Don't change the ID column — it is how rows are matched.",
      "Leave a cell empty to keep the current value; type - to clear an optional field.",
      "Role must be an existing role name (e.g. BUYER, DISTRIBUTOR) and Status one of ACTIVE, INACTIVE, PENDING_VERIFICATION, SUSPENDED.",
      "Passwords are never exported or changed. Created At, Last Login and Orders are for reference only.",
    ],
  },
} as const

export default function BulkDataModal({ mode, entity, filterLabel, filterParam, filterOptions, onClose, onApplied }: Props) {
  const copy = COPY[entity]
  const [filter, setFilter] = useState(filterOptions?.[0]?.value ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const token = () => localStorage.getItem("token") || ""

  const download = async () => {
    setBusy(true)
    setError("")
    try {
      const qs = filter && filterParam ? `?${filterParam}=${encodeURIComponent(filter)}` : ""
      const res = await fetch(`/api/${entity}/export${qs}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message || "Export failed")
      }
      const label = filterOptions?.find((o) => o.value === filter)?.label
      const slug = filter && label ? `-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : ""
      saveAs(await res.blob(), `${entity}${slug}-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed")
    } finally {
      setBusy(false)
    }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/${entity}/bulk-update`, { method: "POST", headers: { Authorization: `Bearer ${token()}` }, body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(Array.isArray(d.message) ? d.message.join(", ") : d.message || "Upload failed")
      setResult(d)
      if ((d.updated || 0) + (d.variantsUpdated || 0) > 0) onApplied?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{mode === "export" ? `Export ${copy.noun}` : `Bulk edit ${copy.noun}`}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {mode === "export" ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">{copy.exportHelp} Edit the file in Excel or Google Sheets, then upload it with <strong>Bulk Edit</strong>.</p>
              {filterOptions && filterOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">{filterLabel}</label>
                  <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
                    {filterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
              <button onClick={download} disabled={busy} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
                <Download size={18} /> {busy ? "Preparing file..." : "Download CSV"}
              </button>
            </>
          ) : (
            <>
              <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 text-sm rounded-xl px-4 py-3">
                <p className="font-medium mb-1">Before you upload</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use a file you downloaded with <strong>Export</strong> and edited.</li>
                  {copy.columns.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
              <label className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition text-sm font-medium cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload size={18} /> {busy ? "Applying changes..." : "Upload edited CSV"}
                <input type="file" accept=".csv,.xlsx,.xls" onChange={upload} disabled={busy} className="hidden" />
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          {result && (
            <div className="space-y-2">
              <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-lg px-4 py-3">
                Updated {result.updated} {copy.noun}
                {result.variantsUpdated ? `, ${result.variantsUpdated} variant${result.variantsUpdated !== 1 ? "s" : ""}` : ""}
                {result.unchanged ? ` · ${result.unchanged} row${result.unchanged !== 1 ? "s" : ""} had no changes` : ""}.
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} skipped:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => <div key={i} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{err}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
