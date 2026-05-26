"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ContractPrice {
  id: string
  productId: string
  userId: string
  price: number
  minQty: number
  validUntil: string | null
  isActive: boolean
  product?: { id: string; title: string }
  user?: { id: string; firstName: string; lastName: string; email: string }
}

export default function AdminContractPricesPage() {
  const [prices, setPrices] = useState<ContractPrice[]>([])
  const [filtered, setFiltered] = useState<ContractPrice[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ContractPrice | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ productId: "", userId: "", price: "", minQty: "1", validUntil: "" })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadPrices(); loadProducts(); loadUsers() }, [token])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(prices.filter((p) => p.product?.title?.toLowerCase().includes(q) || p.user?.email?.toLowerCase().includes(q) || p.user?.firstName?.toLowerCase().includes(q)))
  }, [prices, search])

  const loadPrices = async () => { setLoading(true); try { const res = await fetch("/api/pricing/contract-prices", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); const list = Array.isArray(data) ? data : data.contracts ?? data.contractPrices ?? []; setPrices(list); setFiltered(list) } catch (e) { console.error(e) } finally { setLoading(false) } }
  const loadProducts = async () => { try { const res = await fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setProducts(data.products ?? []) } catch (e) { console.error(e) } }
  const loadUsers = async () => { try { const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setUsers(data.users ?? []) } catch (e) { console.error(e) } }

  const resetForm = () => { setForm({ productId: "", userId: "", price: "", minQty: "1", validUntil: "" }); setEditing(null); setShowForm(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const body: any = { productId: form.productId, userId: form.userId, price: Number(form.price), minQty: Number(form.minQty), validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined }
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(editing ? `/api/pricing/contract-prices/${editing.id}` : "/api/pricing/contract-prices", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) })
      if (res.ok) { resetForm(); loadPrices() } else { const d = await res.json(); alert(d.message || "Failed to save") }
    } catch (e) { console.error(e); alert("Failed to save") } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contract price?")) return
    const t = localStorage.getItem("token")!
    await fetch(`/api/pricing/contract-prices/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
    setPrices((prev) => prev.filter((p) => p.id !== id))
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900">Contract Prices</h1><button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Add Contract Price</button></div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search by product or buyer..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">{editing ? "Edit Contract Price" : "Add Contract Price"}</h2><button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select Product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select Buyer</option>{users.filter((u: any) => u.role === "BUYER").map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select>
            <input required type="number" step="0.01" placeholder="Price per unit" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="number" placeholder="Min Qty (default 1)" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div></div>
            <div className="flex gap-3"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button></div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><p className="text-gray-600">No contract prices found.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Product</th><th className="px-4 py-3 text-left font-medium text-gray-600">Buyer</th><th className="px-4 py-3 text-left font-medium text-gray-600">Price</th><th className="px-4 py-3 text-left font-medium text-gray-600">Min Qty</th><th className="px-4 py-3 text-left font-medium text-gray-600">Valid Until</th><th className="px-4 py-3 text-left font-medium text-gray-600">Status</th><th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.product?.title || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.user ? `${p.user.firstName} ${p.user.lastName}` : "—"}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.minQty}</td>
                  <td className="px-4 py-3 text-gray-500">{p.validUntil ? new Date(p.validUntil).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => { setEditing(p); setForm({ productId: p.productId, userId: p.userId, price: String(p.price), minQty: String(p.minQty), validUntil: p.validUntil?.slice(0, 10) || "" }); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"><Edit2 size={14} /></button><button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}