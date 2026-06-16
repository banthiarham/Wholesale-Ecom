"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  minOrderValue: number | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  startDate: string
  endDate: string
  createdAt: string
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [filtered, setFiltered] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: "", type: "PERCENTAGE", value: "", minOrderValue: "", maxUses: "", startDate: "", endDate: "" })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadCoupons()
  }, [token])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(coupons.filter((c) => c.code.toLowerCase().includes(q)))
  }, [coupons, search])

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pricing/coupons", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setCoupons(Array.isArray(data) ? data : data.coupons ?? [])
      setFiltered(Array.isArray(data) ? data : data.coupons ?? [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const resetForm = () => { setForm({ code: "", type: "PERCENTAGE", value: "", minOrderValue: "", maxUses: "", startDate: "", endDate: "" }); setEditing(null); setShowForm(false) }

  const openEdit = (c: Coupon) => {
    setEditing(c)
    setForm({ code: c.code, type: c.type, value: String(c.value), minOrderValue: c.minOrderValue ? String(c.minOrderValue) : "", maxUses: c.maxUses ? String(c.maxUses) : "", startDate: c.startDate?.slice(0, 10) || "", endDate: c.endDate?.slice(0, 10) || "" })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body: any = {
      code: form.code.toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
    }
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(editing ? `/api/pricing/coupons/${editing.id}` : "/api/pricing/coupons", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { resetForm(); loadCoupons() } else { const d = await res.json(); alert(d.message || "Failed to save coupon") }
    } catch (err) { console.error(err); alert("Failed to save coupon") } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return
    const t = localStorage.getItem("token")!
    await fetch(`/api/pricing/coupons/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
    setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) return <SkeletonTable rows={5} cols={8} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Coupons</h1>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Create Coupon</button>
      </div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" /><input type="text" placeholder="Search coupons..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" /></div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit Coupon" : "Create Coupon"}</h2><button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input required placeholder="Coupon Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"><option value="PERCENTAGE">Percentage (%)</option><option value="FLAT">Flat Amount</option></select>
            <input required type="number" step="0.01" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" />
            <input type="number" step="0.01" placeholder="Min Order Value (optional)" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" />
            <input type="number" placeholder="Max Uses (optional)" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" />
            <div></div>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" />
            <div></div>
            <div className="flex gap-3"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button></div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center"><p className="text-gray-600 dark:text-gray-400">No coupons found.</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Code</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Value</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Min Order</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Uses</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Dates</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100">{c.code}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.type === "PERCENTAGE" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>{c.type === "PERCENTAGE" ? "%" : "Flat"}</span></td>
                  <td className="px-4 py-3 font-medium">{c.type === "PERCENTAGE" ? `${c.value}%` : formatPrice(c.value)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.minOrderValue ? formatPrice(c.minOrderValue) : "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(c.startDate).toLocaleDateString()} — {new Date(c.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>{c.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30"><Edit2 size={14} /></button><button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}