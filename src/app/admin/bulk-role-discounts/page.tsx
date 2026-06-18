"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Percent, Plus, Pencil, Check, X, ToggleLeft, ToggleRight, ArrowLeft, Info } from "lucide-react"
import { useAuth, usePermissions } from "@/lib/auth"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Role {
  id: string
  name: string
  label: string
  description: string | null
  isSystem: boolean
  color: string | null
  icon: string | null
}

interface BulkRoleDiscount {
  id: string
  roleId: string
  discountPercent: number
  label: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  role: { id: string; name: string; label: string; color: string | null; icon: string | null }
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function BulkRoleDiscountsPage() {
  const { can } = usePermissions()
  const { loading: authLoading, user } = useAuth()

  const [discounts, setDiscounts] = useState<BulkRoleDiscount[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editPercent, setEditPercent] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [addRoleId, setAddRoleId] = useState("")
  const [addPercent, setAddPercent] = useState("")
  const [addLabel, setAddLabel] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const [discountsRes, rolesRes] = await Promise.all([
        fetch("/api/pricing/bulk-role-discounts", { headers }),
        fetch("/api/roles", { headers }),
      ])
      const discountsData = await discountsRes.json()
      const rolesData = await rolesRes.json()
      setDiscounts(discountsData.bulkRoleDiscounts || [])
      setRoles(rolesData.roles || [])
    } catch (err) {
      console.error("Failed to fetch data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user && can("admin", "access")) fetchData()
  }, [authLoading, user, can, fetchData])

  if (authLoading || !user || !can("admin", "access")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  const rolesWithDiscounts = roles.map((role) => {
    const discount = discounts.find((d) => d.roleId === role.id)
    return { role, discount }
  })

  const handleCreate = async () => {
    if (!addRoleId || !addPercent) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/pricing/bulk-role-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          roleId: addRoleId,
          discountPercent: parseFloat(addPercent),
          label: addLabel || null,
          isActive: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || "Failed to create discount")
        return
      }
      setShowAdd(false)
      setAddRoleId("")
      setAddPercent("")
      setAddLabel("")
      await fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await fetch(`/api/pricing/bulk-role-discounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          discountPercent: parseFloat(editPercent),
          label: editLabel || null,
        }),
      })
      setEditId(null)
      await fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (discount: BulkRoleDiscount) => {
    try {
      const token = localStorage.getItem("token")
      await fetch(`/api/pricing/bulk-role-discounts/${discount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !discount.isActive }),
      })
      await fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bulk discount?")) return
    try {
      const token = localStorage.getItem("token")
      await fetch(`/api/pricing/bulk-role-discounts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const startEdit = (discount: BulkRoleDiscount) => {
    setEditId(discount.id)
    setEditPercent(String(discount.discountPercent))
    setEditLabel(discount.label || "")
  }

  const availableRoles = roles.filter((r) => !discounts.some((d) => d.roleId === r.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/role-prices" className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Role Discounts</h1>
          </div>
          <p className="text-sm text-gray-500">
            Set a percentage discount for each role that applies to <strong>all products</strong>.
            Per-product role prices take priority when set.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/role-prices"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition"
          >
            Per-Product Pricing
          </Link>
          {availableRoles.length > 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition"
            >
              <Plus size={16} /> Add Discount
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>How it works:</strong> When a user&apos;s role has a bulk discount (e.g., DISTRIBUTOR gets 15% off), that percentage is applied to every product.
          If a specific product already has a per-product <Link href="/admin/role-prices" className="underline font-medium">Role Price</Link> set for that role, the per-product price takes priority and the bulk discount is skipped for that product.
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Bulk Discount</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={addRoleId}
                  onChange={(e) => setAddRoleId(e.target.value)}
                  className="input-base"
                >
                  <option value="">Select a role</option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label || r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={addPercent}
                  onChange={(e) => setAddPercent(e.target.value)}
                  placeholder="e.g. 15"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="e.g. Distributor Volume Discount"
                  className="input-base"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAdd(false); setAddRoleId(""); setAddPercent(""); setAddLabel("") }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!addRoleId || !addPercent || saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount %</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Label</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : rolesWithDiscounts.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No roles found</td></tr>
            ) : (
              rolesWithDiscounts.map(({ role, discount }) => (
                <tr key={role.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {role.color && (
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{role.label || role.name}</div>
                        <div className="text-xs text-gray-500">{role.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editId === discount?.id ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={editPercent}
                        onChange={(e) => setEditPercent(e.target.value)}
                        className="input-base w-24"
                        autoFocus
                      />
                    ) : discount ? (
                      <div className="flex items-center gap-1.5">
                        <Percent size={14} className="text-green-600" />
                        <span className="font-semibold text-gray-900">{Number(discount.discountPercent)}%</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm italic">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editId === discount?.id ? (
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Optional label"
                        className="input-base w-48"
                      />
                    ) : discount?.label ? (
                      <span className="text-sm text-gray-700">{discount.label}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {discount ? (
                      <button onClick={() => handleToggleActive(discount)} className="transition">
                        {discount.isActive ? (
                          <ToggleRight size={28} className="text-green-600" />
                        ) : (
                          <ToggleLeft size={28} className="text-gray-400" />
                        )}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {discount && editId === discount.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(discount.id)}
                          disabled={saving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : discount ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(discount)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(discount.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddRoleId(role.id)
                          setShowAdd(true)
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition"
                      >
                        + Add
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}