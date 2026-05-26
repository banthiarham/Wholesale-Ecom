"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MapPin, Plus, Pencil, Trash2, Check, Home, Building2, ArrowLeft } from "lucide-react"

interface Address {
  id: string
  label: string | null
  street: string
  city: string
  state: string
  zip: string
  country: string
  isDefault: boolean
}

export default function AddressesPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ label: "", street: "", city: "", state: "", zip: "", country: "India", isDefault: false })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  useEffect(() => {
    if (!token) { router.push("/login"); return }
    loadAddresses()
  }, [router])

  const loadAddresses = async () => {
    try {
      const res = await fetch("/api/addresses", { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { const data = await res.json(); setAddresses(data.addresses || []) }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingId ? `/api/addresses/${editingId}` : "/api/addresses"
      const method = editingId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        await loadAddresses()
        resetForm()
      }
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return
    try {
      await fetch(`/api/addresses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch (err) { console.error(err) }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`/api/addresses/${id}/default`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
      await loadAddresses()
    } catch (err) { console.error(err) }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ label: "", street: "", city: "", state: "", zip: "", country: "India", isDefault: false })
  }

  const startEdit = (addr: Address) => {
    setEditingId(addr.id)
    setForm({ label: addr.label || "", street: addr.street, city: addr.city, state: addr.state, zip: addr.zip, country: addr.country, isDefault: addr.isDefault })
    setShowForm(true)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Addresses</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your shipping and billing addresses</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium">
            <Plus size={16} /> Add Address
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">{editingId ? "Edit Address" : "New Address"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Label</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Warehouse, Office" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Street Address *</label>
                <input type="text" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">City *</label>
                  <input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">State *</label>
                  <input type="text" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">PIN Code *</label>
                  <input type="text" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Country</label>
                  <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving..." : editingId ? "Update" : "Save Address"}
                </button>
                <button type="button" onClick={resetForm} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {addresses.length === 0 && !showForm ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={28} className="text-gray-300" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No addresses saved</h2>
            <p className="text-sm text-gray-500 mb-4">Add a shipping address to speed up your checkout.</p>
            <button onClick={() => setShowForm(true)} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm">
              Add First Address
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((addr) => (
              <div key={addr.id} className={`bg-white rounded-xl border ${addr.isDefault ? "border-primary-200" : "border-gray-100"} shadow-sm p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${addr.isDefault ? "bg-primary-50" : "bg-gray-100"}`}>
                      {addr.label?.toLowerCase().includes("office") || addr.label?.toLowerCase().includes("warehouse")
                        ? <Building2 size={18} className={addr.isDefault ? "text-primary-600" : "text-gray-400"} />
                        : <Home size={18} className={addr.isDefault ? "text-primary-600" : "text-gray-400"} />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {addr.label && <span className="text-sm font-semibold text-gray-900">{addr.label}</span>}
                        {addr.isDefault && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-medium">
                            <Check size={12} /> Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{addr.street}</p>
                      <p className="text-sm text-gray-500">{addr.city}, {addr.state} - {addr.zip}</p>
                      <p className="text-xs text-gray-400">{addr.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!addr.isDefault && (
                      <button onClick={() => handleSetDefault(addr.id)} className="text-xs text-primary-600 hover:underline px-2 py-1">Set default</button>
                    )}
                    <button onClick={() => startEdit(addr)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 transition" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(addr.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}