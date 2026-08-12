"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2, Receipt, Building2, Loader2, Check } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import MultiSelect from "@/components/admin/MultiSelect"
import { INDIAN_STATES } from "@/lib/indian-address"

type TaxType = "CGST_SGST" | "IGST"

interface TaxRule {
  id: string
  name: string
  description: string | null
  priority: number
  isActive: boolean
  conditions: { productIds?: string[]; categoryIds?: string[]; region?: string }
  actions: { taxRate?: number; taxLabel?: string; taxType?: TaxType }
  createdAt: string
  updatedAt: string
}

interface Product { id: string; title: string }
interface Category { id: string; name: string }

type TaxForm = {
  name: string
  description: string
  priority: string
  isActive: boolean
  taxRate: string
  taxType: TaxType
  taxLabel: string
  productIds: string[]
  categoryIds: string[]
  region: string
}

const emptyForm = (): TaxForm => ({
  name: "",
  description: "",
  priority: "0",
  isActive: true,
  taxRate: "",
  taxType: "CGST_SGST",
  taxLabel: "",
  productIds: [],
  categoryIds: [],
  region: "",
})

function validateForm(form: TaxForm): string[] {
  const errors: string[] = []
  if (!form.name.trim()) errors.push("Tax Rule Name is required")
  if (form.taxRate === "" || Number(form.taxRate) < 0) errors.push("Total GST Rate is required")
  return errors
}

/** Renders the CGST/SGST or IGST split for a given total rate + type, e.g. "CGST 9% + SGST 9%". */
function splitPreview(taxRate: number, taxType: TaxType): string {
  if (!Number.isFinite(taxRate)) return "—"
  if (taxType === "IGST") return `IGST ${taxRate}%`
  const half = taxRate / 2
  return `CGST ${half}% + SGST ${half}%`
}

export default function AdminTaxPage() {
  const [rules, setRules] = useState<TaxRule[]>([])
  const [filtered, setFiltered] = useState<TaxRule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TaxRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<TaxForm>(emptyForm())
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Business State — the seller's own GST-registered state. Governs every tax rule below:
  // an order ships CGST+SGST when the buyer's shipping state matches this, IGST otherwise.
  const [businessState, setBusinessState] = useState("")
  const [businessStateLoading, setBusinessStateLoading] = useState(true)
  const [businessStateSaving, setBusinessStateSaving] = useState(false)
  const [businessStateSaved, setBusinessStateSaved] = useState(false)

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!t) {
      window.location.href = "/login"
      throw new Error("Not authenticated")
    }
    const headers: Record<string, string> = { ...(options.headers as Record<string, string>), Authorization: `Bearer ${t}` }
    const res = await fetch(url, { ...options, headers })
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token")
      window.location.href = "/login"
      throw new Error("Session expired. Please log in again.")
    }
    return res
  }

  useEffect(() => { loadRules(); loadProducts(); loadCategories(); loadBusinessState() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(rules.filter((r) => r.name.toLowerCase().includes(q) || (r.actions.taxLabel || "").toLowerCase().includes(q)))
  }, [rules, search])

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/rules?type=TAX_RULE")
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadProducts = async () => {
    try {
      const res = await authFetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED")
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch (e) { console.error(e) }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      const flat: Category[] = []
      const walk = (arr: any[]) => { for (const c of arr || []) { flat.push({ id: c.id, name: c.name }); walk(c.children) } }
      walk(data.categories || [])
      setCategories(flat)
    } catch (e) { console.error(e) }
  }

  const loadBusinessState = async () => {
    setBusinessStateLoading(true)
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setBusinessState(data.settings?.businessState || "")
    } catch (e) { console.error(e) } finally { setBusinessStateLoading(false) }
  }

  const saveBusinessState = async (value: string) => {
    setBusinessState(value)
    setBusinessStateSaving(true)
    setBusinessStateSaved(false)
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessState: value }),
      })
      if (res.ok) {
        setBusinessStateSaved(true)
        setTimeout(() => setBusinessStateSaved(false), 2000)
      }
    } catch (e) { console.error(e) } finally { setBusinessStateSaving(false) }
  }

  const resetForm = () => { setForm(emptyForm()); setEditing(null); setShowForm(false); setFormErrors([]) }

  const openEdit = (r: TaxRule) => {
    setEditing(r)
    setForm({
      name: r.name,
      description: r.description || "",
      priority: String(r.priority),
      isActive: r.isActive,
      taxRate: r.actions.taxRate !== undefined ? String(r.actions.taxRate) : "",
      taxType: r.actions.taxType || "CGST_SGST",
      taxLabel: r.actions.taxLabel || "",
      productIds: r.conditions.productIds || [],
      categoryIds: r.conditions.categoryIds || [],
      region: r.conditions.region || "",
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors([])
    const clientErrors = validateForm(form)
    if (clientErrors.length > 0) {
      setFormErrors(clientErrors)
      return
    }

    setSaving(true)
    const body: any = {
      name: form.name,
      type: "TAX_RULE",
      description: form.description || null,
      priority: Number(form.priority) || 0,
      isActive: form.isActive,
      conditions: {
        productIds: form.productIds,
        categoryIds: form.categoryIds,
        region: form.region || undefined,
      },
      actions: {
        taxRate: Number(form.taxRate),
        taxType: form.taxType,
        taxLabel: form.taxLabel || undefined,
      },
    }
    try {
      const res = await authFetch(editing ? `/api/rules/${editing.id}` : "/api/rules", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setToast({ type: "success", message: editing ? "Tax rule updated" : "Tax rule created" })
        resetForm()
        loadRules()
      } else {
        let msg = "Failed to save tax rule"
        try {
          const d = await res.json()
          msg = Array.isArray(d.message) ? d.message.join("; ") : d.message || msg
        } catch {}
        setFormErrors([msg])
        setToast({ type: "error", message: res.status === 409 ? "A tax rule with this name already exists" : "Failed to save tax rule" })
      }
    } catch (e) {
      console.error(e)
      setFormErrors([e instanceof Error ? e.message : "Failed to save tax rule"])
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tax rule?")) return
    try {
      await authFetch(`/api/rules/${id}`, { method: "DELETE" })
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (e) { console.error(e) }
  }

  const handleToggle = async (id: string) => {
    try {
      const res = await authFetch(`/api/rules/${id}/toggle`, { method: "PATCH" })
      if (res.ok) loadRules()
    } catch (e) { console.error(e) }
  }

  const scopeSummary = (r: TaxRule) => {
    const parts: string[] = []
    if (r.conditions.productIds?.length) parts.push(`${r.conditions.productIds.length} product(s)`)
    if (r.conditions.categoryIds?.length) parts.push(`${r.conditions.categoryIds.length} categor${r.conditions.categoryIds.length === 1 ? "y" : "ies"}`)
    if (r.conditions.region) parts.push(`Region: ${r.conditions.region}`)
    return parts.length > 0 ? parts.join(", ") : "All products"
  }

  if (loading) return <SkeletonTable rows={4} cols={6} />

  const previewRate = Number(form.taxRate)
  const hasValidPreviewRate = form.taxRate !== "" && Number.isFinite(previewRate) && previewRate >= 0

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Receipt size={20} className="text-primary-600" /> Tax Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure tax rates applied at checkout and reflected in the buyer&apos;s order summary.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Add Tax Rule</button>
      </div>

      {/* Business State — governs CGST+SGST vs IGST for every tax rule below. */}
      <div className="admin-card-static p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
          <Building2 size={16} className="text-primary-600" /> Business State (for GST)
        </div>
        <select
          value={businessState}
          onChange={(e) => saveBusinessState(e.target.value)}
          disabled={businessStateLoading}
          className="sm:max-w-xs px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <option value="">Not set</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {businessStateSaving && <Loader2 size={16} className="animate-spin text-gray-400" />}
        {businessStateSaved && <span className="flex items-center gap-1 text-xs text-green-600"><Check size={14} /> Saved</span>}
        <p className="text-xs text-gray-400 dark:text-gray-500 sm:ml-auto">
          Orders shipping to <strong>{businessState || "this state"}</strong> get CGST+SGST; every other state gets IGST.
        </p>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input type="text" placeholder="Search tax rules..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {showForm && (
        <div className="admin-card-static p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit Tax Rule" : "Add Tax Rule"}</h2>
            <button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
          </div>

          {formErrors.length > 0 && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
              <ul className="list-disc list-inside space-y-0.5">
                {formErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Rule Name</label>
              <input required placeholder="e.g. GST 18%" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Type</label>
              <select value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value as TaxType })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="CGST_SGST">CGST + SGST</option>
                <option value="IGST">IGST</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {form.taxType === "IGST" ? "IGST Rate (%)" : "Total GST Rate (%)"}
              </label>
              <input required type="number" step="0.01" min="0" placeholder="e.g. 18" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div className="col-span-full -mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasValidPreviewRate ? (
                  <>Preview: <span className="font-medium text-gray-700 dark:text-gray-300">{splitPreview(previewRate, form.taxType)}</span> — this is a single total tax, never charged as GST plus CGST/SGST or IGST on top.</>
                ) : (
                  "Enter a rate above to preview the split."
                )}
                {" "}The actual type applied to each order is determined automatically: same state as the Business State above → CGST+SGST, different state → IGST.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buyer-Facing Label</label>
              <input placeholder="e.g. GST (18%)" value={form.taxLabel} onChange={(e) => setForm({ ...form, taxLabel: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <MultiSelect label="Applicable Products (optional, blank = all)" items={products.map((p) => ({ id: p.id, label: p.title }))} selectedIds={form.productIds} onChange={(ids) => setForm({ ...form, productIds: ids })} mode="inline" searchable />
            <MultiSelect label="Applicable Categories (optional, blank = all)" items={categories.map((c) => ({ id: c.id, label: c.name }))} selectedIds={form.categoryIds} onChange={(ids) => setForm({ ...form, categoryIds: ids })} mode="inline" searchable />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region (optional)</label>
              <input placeholder="e.g. Maharashtra" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Matched against the buyer&apos;s shipping state to decide whether this rule applies at all. Leave blank to apply everywhere.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <input type="number" placeholder="Priority (lower = higher)" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
              <input placeholder="Internal note" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300 accent-primary-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>

            <div className="col-span-full flex gap-3 pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <Receipt size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No tax rules configured yet.</p>
        </div>
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Rate</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">GST Split (preview)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Buyer Label</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Scope</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.actions.taxRate ?? 0}%</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{splitPreview(r.actions.taxRate ?? 0, r.actions.taxType || "CGST_SGST")}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.actions.taxLabel || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{scopeSummary(r)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.priority}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(r.id)} className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${r.isActive ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                        {r.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-primary-600 dark:text-gray-500 dark:hover:text-primary-400 transition"><Edit2 size={15} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
