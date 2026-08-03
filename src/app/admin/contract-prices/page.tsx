"use client"

import { useEffect, useState, useRef } from "react"
import { Plus, Search, X, Trash2, Edit2, User, Building2, Mail, Users } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"

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

interface Buyer {
  id: string
  firstName: string
  lastName: string
  email: string
  companyName?: string | null
  role: string
}

export default function AdminContractPricesPage() {
  const [prices, setPrices] = useState<ContractPrice[]>([])
  const [filtered, setFiltered] = useState<ContractPrice[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loadingBuyers, setLoadingBuyers] = useState(true)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ContractPrice | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ productId: "", userId: "", price: "", minQty: "1", validUntil: "" })

  // Buyer search combobox
  const [buyerSearch, setBuyerSearch] = useState("")
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false)
  const buyerDropdownRef = useRef<HTMLDivElement>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadPrices(); loadProducts(); loadBuyers() }, [token])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(prices.filter((p) => p.product?.title?.toLowerCase().includes(q) || p.user?.email?.toLowerCase().includes(q) || p.user?.firstName?.toLowerCase().includes(q)))
  }, [prices, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (buyerDropdownRef.current && !buyerDropdownRef.current.contains(e.target as Node)) setShowBuyerDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const loadPrices = async () => { setLoading(true); try { const res = await fetch("/api/pricing/contract-prices", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); const list = Array.isArray(data) ? data : data.contracts ?? data.contractPrices ?? []; setPrices(list); setFiltered(list) } catch (e) { console.error(e) } finally { setLoading(false) } }
  const loadProducts = async () => { try { const res = await fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setProducts(data.products ?? []) } catch (e) { console.error(e) } }
  // Every registered buyer account, straight from the database — server-side role
  // filter (not a client-side slice of a paginated "all users" call) with a take
  // large enough to cover realistic buyer counts, independent of who's online.
  const loadBuyers = async () => {
    setLoadingBuyers(true)
    try {
      const res = await fetch("/api/users?role=BUYER&take=10000", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setBuyers(data.users ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingBuyers(false)
    }
  }

  const filteredBuyers = buyers.filter((b) => {
    const q = buyerSearch.toLowerCase()
    if (!q) return true
    return (
      `${b.firstName} ${b.lastName}`.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      b.companyName?.toLowerCase().includes(q)
    )
  })

  const selectedBuyer = buyers.find((b) => b.id === form.userId)

  const selectBuyer = (b: Buyer) => {
    setForm((f) => ({ ...f, userId: b.id }))
    setBuyerSearch(`${b.firstName} ${b.lastName}`)
    setShowBuyerDropdown(false)
  }

  const resetForm = () => { setForm({ productId: "", userId: "", price: "", minQty: "1", validUntil: "" }); setEditing(null); setShowForm(false); setBuyerSearch("") }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.userId) { alert("Please select a buyer"); return }
    setSaving(true)
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

  if (loading) return <SkeletonTable />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Contract Prices</h1><button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Add Contract Price</button></div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" /><input type="text" placeholder="Search by product or buyer..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>

      {showForm && (
        <div className="admin-card-static p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit Contract Price" : "Add Contract Price"}</h2><button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={20} /></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select Product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            <div className="relative" ref={buyerDropdownRef}>
              {!loadingBuyers && buyers.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-400 dark:text-gray-500">
                  <Users size={14} /> No buyers found
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search buyers by name, company, or email..."
                      value={buyerSearch}
                      onChange={(e) => { setBuyerSearch(e.target.value); setShowBuyerDropdown(true); if (form.userId) setForm((f) => ({ ...f, userId: "" })) }}
                      onFocus={() => setShowBuyerDropdown(true)}
                      className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {form.userId && (
                      <button type="button" onClick={() => { setForm((f) => ({ ...f, userId: "" })); setBuyerSearch("") }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {showBuyerDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredBuyers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No buyers match your search</div>
                      ) : (
                        filteredBuyers.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => selectBuyer(b)}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30 transition flex items-center justify-between gap-3 ${form.userId === b.id ? "bg-primary-50 dark:bg-primary-900/30" : ""}`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                                <User size={12} className="text-gray-400 flex-shrink-0" /> {b.firstName} {b.lastName}
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded font-medium uppercase flex-shrink-0">{b.role}</span>
                              </div>
                              {b.companyName && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  <Building2 size={11} className="flex-shrink-0" /> {b.companyName}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                <Mail size={11} className="flex-shrink-0" /> {b.email}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <input required type="number" step="0.01" placeholder="Price per unit" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="number" placeholder="Min Qty (default 1)" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div></div>
            <div className="flex gap-3"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button></div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center"><p className="text-gray-600 dark:text-gray-400">No contract prices found.</p></div>
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Product</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Buyer</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Price</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Min Qty</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Valid Until</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.product?.title || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.user ? `${p.user.firstName} ${p.user.lastName}` : "—"}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.minQty}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.validUntil ? new Date(p.validUntil).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => { setEditing(p); setForm({ productId: p.productId, userId: p.userId, price: String(p.price), minQty: String(p.minQty), validUntil: p.validUntil?.slice(0, 10) || "" }); setBuyerSearch(p.user ? `${p.user.firstName} ${p.user.lastName}` : ""); setShowForm(true) }} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"><Edit2 size={14} /></button><button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button></div></td>
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