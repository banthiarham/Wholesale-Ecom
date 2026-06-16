"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2 } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { formatPrice } from "@/lib/utils"

interface PaymentOffer {
  id: string
  name: string
  offerType: "BANK" | "UPI"
  type: string
  value: number
  maxDiscount: number | null
  minOrderValue: number | null
  bankName: string | null
  upiApp: string | null
  cardType: string | null
  startDate: string
  endDate: string
  isActive: boolean
  productId: string | null
  categoryId: string | null
  description: string | null
  product?: { id: string; title: string }
  category?: { id: string; name: string }
}

interface Category { id: string; name: string; handle: string; children?: Category[] }

const BANKS = ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "PNB", "Bank of Baroda", "IDFC First", "IndusInd", "Yes Bank", "Canara Bank", "Union Bank"]
const UPI_APPS = [
  { value: "GOOGLE_PAY", label: "Google Pay" },
  { value: "PHONEPE", label: "PhonePe" },
  { value: "PAYTM", label: "Paytm" },
  { value: "BHIM", label: "BHIM UPI" },
  { value: "AMAZON_PAY", label: "Amazon Pay" },
  { value: "FREECHARGE", label: "Freecharge" },
  { value: "MOBIKWIK", label: "Mobikwik" },
]

const initialForm = {
  name: "", offerType: "BANK" as "BANK" | "UPI", type: "PERCENTAGE", value: "",
  maxDiscount: "", minOrderValue: "", bankName: "", upiApp: "", cardType: "BOTH",
  startDate: "", endDate: "", productId: "", categoryId: "", description: "",
}

export default function AdminPaymentOffersPage() {
  const [offers, setOffers] = useState<PaymentOffer[]>([])
  const [filtered, setFiltered] = useState<PaymentOffer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PaymentOffer | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialForm)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadOffers(); loadCategories(); loadProducts() }, [token])
  useEffect(() => { const q = search.toLowerCase(); setFiltered(offers.filter((o) => o.name.toLowerCase().includes(q) || (o.bankName || "").toLowerCase().includes(q) || (o.upiApp || "").toLowerCase().includes(q))) }, [offers, search])

  const loadOffers = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pricing/payment-offers")
      const data = await res.json()
      setOffers(Array.isArray(data) ? data : data.offers ?? [])
      setFiltered(Array.isArray(data) ? data : data.offers ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      const flat: Category[] = []
      const walk = (arr: any[]) => { for (const c of arr || []) { flat.push({ id: c.id, name: c.name, handle: c.handle }); walk(c.children) } }
      walk(data.categories || [])
      setCategories(flat)
    } catch (e) { console.error(e) }
  }
  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch (e) { console.error(e) }
  }

  const resetForm = () => { setForm(initialForm); setEditing(null); setShowForm(false) }

  const openEdit = (o: PaymentOffer) => {
    setEditing(o)
    setForm({
      name: o.name, offerType: o.offerType, type: o.type, value: String(o.value),
      maxDiscount: o.maxDiscount != null ? String(o.maxDiscount) : "", minOrderValue: o.minOrderValue != null ? String(o.minOrderValue) : "",
      bankName: o.bankName || "", upiApp: o.upiApp || "", cardType: o.cardType || "BOTH",
      startDate: o.startDate?.slice(0, 10) || "", endDate: o.endDate?.slice(0, 10) || "",
      productId: o.productId || "", categoryId: o.categoryId || "", description: o.description || "",
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const body: any = {
      name: form.name, offerType: form.offerType, type: form.type,
      value: Number(form.value), maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
      bankName: form.offerType === "BANK" ? form.bankName : undefined,
      upiApp: form.offerType === "UPI" ? form.upiApp : undefined,
      cardType: form.offerType === "BANK" ? form.cardType : undefined,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      productId: form.productId || undefined, categoryId: form.categoryId || undefined,
      description: form.description || undefined,
    }
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(editing ? `/api/pricing/payment-offers/${editing.id}` : "/api/pricing/payment-offers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { resetForm(); loadOffers() } else { const d = await res.json(); alert(d.message || "Failed to save") }
    } catch (e) { console.error(e); alert("Failed to save") } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payment offer?")) return
    const t = localStorage.getItem("token")!
    await fetch(`/api/pricing/payment-offers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
    setOffers((prev) => prev.filter((o) => o.id !== id))
  }

  const toggleActive = async (o: PaymentOffer) => {
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(`/api/pricing/payment-offers/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ ...o, isActive: !o.isActive, startDate: o.startDate, endDate: o.endDate }),
      })
      if (res.ok) loadOffers()
    } catch (e) { console.error(e) }
  }

  if (loading) return <SkeletonTable />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Payment Offers</h1>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Create Offer</button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input type="text" placeholder="Search offers..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit Offer" : "Create Offer"}</h2>
            <button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input required placeholder="Offer Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value as "BANK" | "UPI", bankName: "", upiApp: "", cardType: "BOTH" })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="BANK">Bank Offer</option>
              <option value="UPI">UPI Offer</option>
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Amount</option>
            </select>
            <input required type="number" step="0.01" placeholder="Discount Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="number" step="0.01" placeholder="Max Discount (optional)" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="number" step="0.01" placeholder="Min Order Value (optional)" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />

            {form.offerType === "BANK" && (
              <>
                <select value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select Bank</option>
                  {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={form.cardType} onChange={(e) => setForm({ ...form, cardType: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="BOTH">Both Cards</option>
                  <option value="CREDIT">Credit Card Only</option>
                  <option value="DEBIT">Debit Card Only</option>
                </select>
              </>
            )}

            {form.offerType === "UPI" && (
              <select value={form.upiApp} onChange={(e) => setForm({ ...form, upiApp: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select UPI App</option>
                {UPI_APPS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            )}

            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, categoryId: e.target.value ? "" : form.categoryId })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">All Products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, productId: e.target.value ? "" : form.productId })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <textarea placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3 col-span-full">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center"><p className="text-gray-600 dark:text-gray-400">No payment offers found. Create one to get started.</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Discount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Max Disc.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Min Order</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Scope</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Dates</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{o.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.offerType === "BANK" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" : "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"}`}>
                        {o.offerType === "BANK" ? "🏦 Bank" : "📱 UPI"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {o.offerType === "BANK" ? (o.bankName || "Any Bank") + (o.cardType && o.cardType !== "BOTH" ? ` (${o.cardType.toLowerCase()})` : "") : o.upiApp || "Any UPI"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {o.type === "PERCENTAGE" ? `${o.value}%` : formatPrice(o.value)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{o.maxDiscount != null ? formatPrice(o.maxDiscount) : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{o.minOrderValue != null ? formatPrice(o.minOrderValue) : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{o.product?.title || o.category?.name || "All"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(o.startDate).toLocaleDateString()} — {new Date(o.endDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(o)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.isActive ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                        {o.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(o)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(o.id)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
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