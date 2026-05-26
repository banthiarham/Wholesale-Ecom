"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Discount {
  id: string
  name: string
  type: string
  value: number
  minQty: number
  startDate: string
  endDate: string
  isActive: boolean
  productId: string | null
  categoryId: string | null
  product?: { title: string }
  category?: { name: string }
}

interface Category { id: string; name: string; handle: string; children?: Category[] }

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [filtered, setFiltered] = useState<Discount[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", type: "PERCENTAGE", value: "", minQty: "1", startDate: "", endDate: "", productId: "", categoryId: "" })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadDiscounts(); loadCategories(); loadProducts() }, [token])
  useEffect(() => { const q = search.toLowerCase(); setFiltered(discounts.filter((d) => d.name.toLowerCase().includes(q))) }, [discounts, search])

  const loadDiscounts = async () => {
    setLoading(true)
    try { const res = await fetch("/api/pricing/seasonal-discounts"); const data = await res.json(); setDiscounts(Array.isArray(data) ? data : data.discounts ?? []); setFiltered(Array.isArray(data) ? data : data.discounts ?? []) } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  const loadCategories = async () => { try { const res = await fetch("/api/categories"); const data = await res.json(); const flat: Category[] = []; const walk = (arr: any[]) => { for (const c of arr || []) { flat.push({ id: c.id, name: c.name, handle: c.handle }); walk(c.children) } }; walk(data.categories || []); setCategories(flat) } catch (e) { console.error(e) } }
  const loadProducts = async () => { try { const res = await fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setProducts(data.products ?? []) } catch (e) { console.error(e) } }

  const resetForm = () => { setForm({ name: "", type: "PERCENTAGE", value: "", minQty: "1", startDate: "", endDate: "", productId: "", categoryId: "" }); setEditing(null); setShowForm(false) }

  const openEdit = (d: Discount) => {
    setEditing(d)
    setForm({ name: d.name, type: d.type, value: String(d.value), minQty: String(d.minQty), startDate: d.startDate?.slice(0, 10) || "", endDate: d.endDate?.slice(0, 10) || "", productId: d.productId || "", categoryId: d.categoryId || "" })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const body: any = { name: form.name, type: form.type, value: Number(form.value), minQty: Number(form.minQty), startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined, endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined, productId: form.productId || undefined, categoryId: form.categoryId || undefined }
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(editing ? `/api/pricing/seasonal-discounts/${editing.id}` : "/api/pricing/seasonal-discounts", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) })
      if (res.ok) { resetForm(); loadDiscounts() } else { const d = await res.json(); alert(d.message || "Failed to save") }
    } catch (e) { console.error(e); alert("Failed to save") } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this discount?")) return
    const t = localStorage.getItem("token")!
    await fetch(`/api/pricing/seasonal-discounts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
    setDiscounts((prev) => prev.filter((d) => d.id !== id))
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900">Seasonal Discounts</h1><button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Create Discount</button></div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search discounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">{editing ? "Edit Discount" : "Create Discount"}</h2><button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="PERCENTAGE">Percentage (%)</option><option value="FLAT">Flat Amount</option></select>
            <input required type="number" step="0.01" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="number" placeholder="Min Qty (default 1)" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, categoryId: e.target.value ? "" : form.categoryId })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Products</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, productId: e.target.value ? "" : form.productId })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button></div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><p className="text-gray-600">No discounts found.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Name</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Value</th><th className="px-4 py-3 text-left font-medium text-gray-600">Min Qty</th><th className="px-4 py-3 text-left font-medium text-gray-600">Scope</th><th className="px-4 py-3 text-left font-medium text-gray-600">Dates</th><th className="px-4 py-3 text-left font-medium text-gray-600">Status</th><th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.type === "PERCENTAGE" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>{d.type === "PERCENTAGE" ? "%" : "Flat"}</span></td>
                  <td className="px-4 py-3 font-medium">{d.type === "PERCENTAGE" ? `${d.value}%` : formatPrice(d.value)}</td>
                  <td className="px-4 py-3 text-gray-600">{d.minQty}</td>
                  <td className="px-4 py-3 text-gray-600">{d.product?.title || d.category?.name || "All"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.startDate).toLocaleDateString()} — {new Date(d.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{d.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"><Edit2 size={14} /></button><button onClick={() => handleDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}