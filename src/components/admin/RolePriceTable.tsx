"use client"

import { Fragment, useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Plus, Trash2, Save, Check, Edit2, ChevronDown, ChevronRight, Users, Percent, ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"

export interface Role {
  id: string
  name: string
  label: string
  description: string
  isSystem: boolean
  color: string
  icon: string
}

export interface RolePrice {
  id: string
  productId: string
  roleId: string
  price: number
  minQty: number
  isActive: boolean
  product?: any
  role?: Role
}

export interface RolePriceProduct {
  id: string
  title: string
  sku?: string
  unitPrice: number
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

// The per-role price table shared by the Role Pricing page and the product edit form. Both
// read/write the same rolePrice rows, so a change made in one shows up in the other.
// `reloadKey` — bump it to make the table refetch (e.g. after a bulk save elsewhere).
// `onChange` — called after any save/delete so the host can refresh its own copy.
export default function RolePriceTable({
  product: selectedProduct,
  reloadKey = 0,
  onChange,
}: {
  product: RolePriceProduct
  reloadKey?: number
  onChange?: () => void
}) {
  const [roles, setRoles] = useState<Role[]>([])
  const [rolePrices, setRolePrices] = useState<RolePrice[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Inline editing — rowId is a RolePrice.id, or a synthetic "new-<roleId>[-N]" id for a
  // tier that hasn't been saved to the server yet (mirrors the create-on-first-edit pattern
  // the single-tier version of this page already used for its one row per role).
  const [editingCell, setEditingCell] = useState<{ rowId: string; roleId: string; field: "price" | "minQty" } | null>(null)
  const [editValue, setEditValue] = useState("")
  const newTierCounter = useRef(0)

  // Which roles have their extra tiers expanded (roles with only one tier never need this).
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())

  // Active toggles (local state for immediate feedback) — keyed by row id, not role id,
  // since a role can now have several independently-active tiers.
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({})

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true)
    try {
      const res = await fetch("/api/roles", { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.roles ?? []
      // Role-based pricing applies to purchasing (buyer-side) roles only — ADMIN is staff, not a customer segment.
      setRoles(list.filter((r: Role) => r.name !== "ADMIN"))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRoles(false)
    }
  }, [])

  const loadRolePrices = useCallback(async (productId: string) => {
    setLoadingPrices(true)
    try {
      const res = await fetch(`/api/pricing/role-prices?productId=${productId}`, { credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      const data = await res.json()
      const list: RolePrice[] = Array.isArray(data) ? data : data.rolePrices ?? []
      setRolePrices(list)
      // Initialize active toggles from loaded data, keyed by each tier's own row id.
      const toggles: Record<string, boolean> = {}
      list.forEach((rp) => { toggles[rp.id] = rp.isActive })
      setActiveToggles(toggles)
      setExpandedRoles(new Set())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPrices(false)
    }
  }, [])
  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useEffect(() => {
    loadRolePrices(selectedProduct.id)
  }, [selectedProduct.id, reloadKey, loadRolePrices])

  // ---- Helpers ----

  // All saved/local tiers for a role, sorted by minimum quantity — this is now the
  // authoritative way to read a role's pricing (a role can have several tiers).
  const getRoleTiers = (roleId: string): RolePrice[] =>
    rolePrices.filter((rp) => rp.roleId === roleId).sort((a, b) => a.minQty - b.minQty)

  // Rows to actually render for a role: its real tiers, or — if none exist yet — a single
  // synthetic "Not set" placeholder row so the table still shows exactly one editable row
  // per role by default, same as before this feature existed.
  const getDisplayRows = (roleId: string): RolePrice[] => {
    const tiers = getRoleTiers(roleId)
    if (tiers.length > 0) return tiers
    return [{ id: `new-${roleId}`, productId: selectedProduct?.id || "", roleId, price: 0, minQty: 1, isActive: true }]
  }

  const getRoleById = (roleId: string): Role | undefined => {
    return roles.find((r) => r.id === roleId)
  }

  const discountPercent = (basePrice: number, customPrice: number | undefined): number | null => {
    if (customPrice === undefined || !basePrice) return null
    const pct = ((basePrice - customPrice) / basePrice) * 100
    return Math.round(pct * 10) / 10
  }

  // ---- Actions ----

  const toggleExpanded = (roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  const handleAddTier = (roleId: string) => {
    const tiers = getRoleTiers(roleId)
    const lastTier = tiers[tiers.length - 1]
    const id = `new-${roleId}-${newTierCounter.current++}`
    const newRow: RolePrice = {
      id,
      productId: selectedProduct?.id || "",
      roleId,
      price: lastTier ? lastTier.price : 0,
      minQty: lastTier ? lastTier.minQty + 1 : 1,
      isActive: true,
    }
    setRolePrices((prev) => [...prev, newRow])
    setExpandedRoles((prev) => new Set(prev).add(roleId))
    // Jump straight into editing the new tier's price so the admin can type immediately.
    setEditingCell({ rowId: id, roleId, field: "price" })
    setEditValue(String(newRow.price))
  }

  const handleSaveRow = async (rowId: string, roleId: string) => {
    if (!selectedProduct) return
    const row = rolePrices.find((rp) => rp.id === rowId)
    const price = row?.price ?? 0
    const minQty = row?.minQty ?? 1
    const isActive = activeToggles[rowId] ?? row?.isActive ?? true
    const isNew = rowId.startsWith("new-")

    setSavingId(rowId)
    try {
      if (!isNew) {
        // Update
        const res = await fetch(`/api/pricing/role-prices/${rowId}`, {
          method: "PUT",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({ price, minQty, isActive }),
        })
        if (res.ok) {
          const data = await res.json()
          setRolePrices((prev) => prev.map((rp) => (rp.id === rowId ? (data.rolePrice ?? data) : rp)))
          onChange?.()
        } else {
          const d = await res.json()
          alert(d.message || "Failed to update tier")
        }
      } else {
        // Create
        const res = await fetch("/api/pricing/role-prices", {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({ productId: selectedProduct.id, roleId, price, minQty, isActive }),
        })
        if (res.ok) {
          const data = await res.json()
          const created: RolePrice = data.rolePrice ?? data
          setRolePrices((prev) => prev.map((rp) => (rp.id === rowId ? created : rp)))
          setActiveToggles((prev) => {
            if (prev[rowId] === undefined) return prev
            const { [rowId]: moved, ...rest } = prev
            return { ...rest, [created.id]: moved }
          })
          onChange?.()
        } else {
          const d = await res.json()
          alert(d.message || "Failed to create tier")
        }
      }
    } catch (e) {
      console.error(e)
      alert("Failed to save")
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (rowId: string) => {
    // An unsaved local tier — just drop it, nothing to delete server-side.
    if (rowId.startsWith("new-")) {
      setRolePrices((prev) => prev.filter((rp) => rp.id !== rowId))
      return
    }
    if (!confirm("Delete this tier?")) return

    setDeletingId(rowId)
    try {
      const res = await fetch(`/api/pricing/role-prices/${rowId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
      if (res.ok) {
        setRolePrices((prev) => prev.filter((rp) => rp.id !== rowId))
        onChange?.()
      } else {
        alert("Failed to delete")
      }
    } catch (e) {
      console.error(e)
      alert("Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleActive = (rowId: string) => {
    setActiveToggles((prev) => ({ ...prev, [rowId]: !(prev[rowId] ?? true) }))
  }

  // ---- Inline editing ----

  const startEditing = (rowId: string, roleId: string, field: "price" | "minQty") => {
    const row = rolePrices.find((rp) => rp.id === rowId)
    const value = field === "price" ? (row?.price ?? 0) : (row?.minQty ?? 1)
    setEditingCell({ rowId, roleId, field })
    setEditValue(String(value))
  }

  const commitEdit = () => {
    if (!editingCell) return
    const { rowId, roleId, field } = editingCell
    const numValue = parseFloat(editValue)
    if (isNaN(numValue) || numValue < 0) {
      setEditingCell(null)
      return
    }
    const rounded = field === "minQty" ? Math.round(numValue) : numValue

    setRolePrices((prev) => {
      if (prev.some((rp) => rp.id === rowId)) {
        return prev.map((rp) => (rp.id === rowId ? { ...rp, [field]: rounded } : rp))
      }
      // First edit on the synthetic "Not set" row for a role with zero tiers — materialize
      // it locally now so Save/Delete/further edits have a real row to act on.
      return [
        ...prev,
        {
          id: rowId,
          productId: selectedProduct?.id || "",
          roleId,
          price: field === "price" ? rounded : 0,
          minQty: field === "minQty" ? rounded : 1,
          isActive: activeToggles[rowId] ?? true,
        },
      ]
    })
    setEditingCell(null)
  }

  return (
        <div className="admin-card-static overflow-hidden">
          {loadingPrices || loadingRoles ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : roles.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={26} className="text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">No buyer roles found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Create at least one buyer role before setting up role-based pricing.</p>
              <Link href="/admin/roles" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
                Go to Role Management <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Base Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Custom Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Discount %</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Min Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Enable/Disable</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {roles.map((role) => {
                  const displayRows = getDisplayRows(role.id)
                  const [primaryRow, ...extraRows] = displayRows
                  const hasMultipleTiers = extraRows.length > 0
                  const isExpanded = expandedRoles.has(role.id)

                  const renderRow = (rp: RolePrice, isPrimary: boolean) => {
                    const isActive = activeToggles[rp.id] ?? rp.isActive ?? true
                    const isEditingPrice = editingCell?.rowId === rp.id && editingCell?.field === "price"
                    const isEditingMinQty = editingCell?.rowId === rp.id && editingCell?.field === "minQty"
                    const isSaved = !rp.id.startsWith("new-") || rolePrices.some((existing) => existing.id === rp.id)

                    return (
                      <tr key={rp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        {/* Role Name + Color Badge (primary row only) / tier indicator (extra rows) */}
                        <td className="px-4 py-3">
                          {isPrimary ? (
                            <div className="flex items-center gap-2">
                              {hasMultipleTiers ? (
                                <button onClick={() => toggleExpanded(role.id)} className="text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 flex-shrink-0">
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : (
                                <span className="w-3.5 flex-shrink-0" />
                              )}
                              <span
                                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: role.color || "#6b7280" }}
                              />
                              <span className="font-medium text-gray-900 dark:text-gray-100">{role.label || role.name}</span>
                              {role.isSystem && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded font-medium uppercase">
                                  System
                                </span>
                              )}
                              {hasMultipleTiers && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded font-medium">
                                  {displayRows.length} tiers
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pl-8 text-gray-400 dark:text-gray-500">
                              <span className="text-xs">↳ tier</span>
                            </div>
                          )}
                        </td>

                        {/* Base Price (read-only, from product) */}
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {formatPrice(selectedProduct.unitPrice)}
                        </td>

                        {/* Custom Price */}
                        <td className="px-4 py-3">
                          {isEditingPrice ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null) }}
                                autoFocus
                                className="w-28 px-2 py-1 border border-primary-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <Check size={14} className="text-primary-600 cursor-pointer" onClick={commitEdit} />
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:text-primary-600 flex items-center gap-1"
                              onClick={() => startEditing(rp.id, role.id, "price")}
                            >
                              {isSaved ? formatPrice(rp.price) : <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>}
                              <Edit2 size={12} className="text-gray-300 dark:text-gray-600" />
                            </span>
                          )}
                        </td>

                        {/* Discount % (derived from base vs custom price) */}
                        <td className="px-4 py-3">
                          {(() => {
                            const pct = discountPercent(Number(selectedProduct.unitPrice), isSaved ? rp.price : undefined)
                            if (pct === null) return <span className="text-gray-300 dark:text-gray-600">—</span>
                            if (pct <= 0) return <span className="text-gray-400 dark:text-gray-500">0%</span>
                            return (
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                                <Percent size={11} /> {pct}% off
                              </span>
                            )
                          })()}
                        </td>

                        {/* Min Qty */}
                        <td className="px-4 py-3">
                          {isEditingMinQty ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null) }}
                                autoFocus
                                className="w-20 px-2 py-1 border border-primary-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <Check size={14} className="text-primary-600 cursor-pointer" onClick={commitEdit} />
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:text-primary-600 flex items-center gap-1"
                              onClick={() => startEditing(rp.id, role.id, "minQty")}
                            >
                              {isSaved ? rp.minQty : <span className="text-gray-400 dark:text-gray-500 italic">1</span>}
                              <Edit2 size={12} className="text-gray-300 dark:text-gray-600" />
                            </span>
                          )}
                        </td>

                        {/* Active Toggle */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(rp.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                              isActive ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                isActive ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isPrimary && (
                              <button
                                onClick={() => handleAddTier(role.id)}
                                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition"
                                title="Add Tier"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleSaveRow(rp.id, role.id)}
                              disabled={savingId === rp.id}
                              className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition disabled:opacity-50"
                              title="Save"
                            >
                              {savingId === rp.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                              ) : (
                                <Save size={14} />
                              )}
                            </button>
                            {isSaved && (
                              <button
                                onClick={() => handleDelete(rp.id)}
                                disabled={deletingId === rp.id}
                                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === rp.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <Fragment key={role.id}>
                      {renderRow(primaryRow, true)}
                      {isExpanded && extraRows.map((rp) => renderRow(rp, false))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
  )
}
