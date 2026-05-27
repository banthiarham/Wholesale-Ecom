"use client"

import { useEffect, useState } from "react"
import {
  Truck,
  Plus,
  Edit3,
  Trash2,
  X,
  Loader2,
  ExternalLink,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"

interface DeliveryPartner {
  id: string
  name: string
  code: string
  trackingUrlTemplate: string | null
  contactEmail: string | null
  contactPhone: string | null
  logo: string | null
  isActive: boolean
  _count?: { orders: number }
}

export default function AdminDeliveryPartnersPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DeliveryPartner | null>(null)
  const [form, setForm] = useState({ name: "", code: "", trackingUrlTemplate: "", contactEmail: "", contactPhone: "", isActive: true })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""

  useEffect(() => {
    fetch("/api/delivery-partners/all", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPartners(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const savePartner = async () => {
    setSaving(true)
    try {
      const url = editing ? `/api/delivery-partners/${editing.id}` : "/api/delivery-partners"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed")
      const saved = await res.json()
      if (editing) {
        setPartners((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
      } else {
        setPartners((prev) => [...prev, saved])
      }
      setShowForm(false)
      setEditing(null)
      setSuccess(editing ? "Partner updated" : "Partner created")
      setTimeout(() => setSuccess(""), 3000)
    } catch {
      alert("Failed to save partner")
    } finally {
      setSaving(false)
    }
  }

  const deletePartner = async (id: string) => {
    if (!confirm("Deactivate this partner?")) return
    const res = await fetch(`/api/delivery-partners/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const updated = await res.json()
    if (updated.isActive === false) {
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)))
    } else {
      setPartners((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const toggleActive = async (partner: DeliveryPartner) => {
    const res = await fetch(`/api/delivery-partners/${partner.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !partner.isActive }),
    })
    const updated = await res.json()
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? updated : p)))
  }

  const startEdit = (partner: DeliveryPartner) => {
    setEditing(partner)
    setForm({
      name: partner.name,
      code: partner.code,
      trackingUrlTemplate: partner.trackingUrlTemplate || "",
      contactEmail: partner.contactEmail || "",
      contactPhone: partner.contactPhone || "",
      isActive: partner.isActive,
    })
    setShowForm(true)
  }

  const startAdd = () => {
    setEditing(null)
    setForm({ name: "", code: "", trackingUrlTemplate: "", contactEmail: "", contactPhone: "", isActive: true })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
          <p className="text-sm text-gray-500">Manage courier and logistics partners</p>
        </div>
        <button onClick={startAdd} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition">
          <Plus size={16} /> Add Partner
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{editing ? "Edit Partner" : "Add Partner"}</h2>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="e.g. DELHIVERY" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tracking URL Template</label>
              <input type="text" value={form.trackingUrlTemplate} onChange={(e) => setForm({ ...form, trackingUrlTemplate: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="https://example.com/track/{trackingNumber}" />
              <p className="text-xs text-gray-400 mt-1">Use {"{trackingNumber}"} as placeholder for the actual tracking number</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={savePartner} disabled={saving || !form.name || !form.code} className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Partner</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tracking URL</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Orders</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {partners.map((p) => (
              <tr key={p.id} className={`hover:bg-gray-50 ${!p.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-900">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.code}</td>
                <td className="px-4 py-3">
                  {p.trackingUrlTemplate ? (
                    <span className="text-xs text-gray-500 truncate max-w-[200px] block">{p.trackingUrlTemplate}</span>
                  ) : (
                    <span className="text-xs text-gray-400">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.contactEmail && <p className="text-xs text-gray-600">{p.contactEmail}</p>}
                  {p.contactPhone && <p className="text-xs text-gray-500">{p.contactPhone}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{p._count?.orders ?? 0}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(p)} className="text-gray-500 hover:text-primary-600">
                    {p.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"><Edit3 size={14} /></button>
                    <button onClick={() => deletePartner(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partners.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Truck size={40} className="mx-auto mb-3" />
            <p>No delivery partners yet</p>
          </div>
        )}
      </div>
    </div>
  )
}