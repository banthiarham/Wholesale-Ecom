"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Search, DollarSign, Plus, Trash2, Save, X, Eye, ChevronDown, Edit2, Check } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Role {
  id: string
  name: string
  label: string
  description: string
  isSystem: boolean
  color: string
  icon: string
}

interface RolePrice {
  id: string
  productId: string
  roleId: string
  price: number
  minQty: number
  isActive: boolean
  product?: any
  role?: Role
}

interface Product {
  id: string
  title: string
  sku: string
  unitPrice: number
}

interface PricingBreakdown {
  effectivePrice: number
  rolePrice?: number
  basePrice: number
  discount?: number
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

export default function AdminRolePricesPage() {
  // Data
  const [roles, setRoles] = useState<Role[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [rolePrices, setRolePrices] = useState<RolePrice[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Product search
  const [productSearch, setProductSearch] = useState("")
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Loading states
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: "price" | "minQty" } | null>(null)
  const [editValue, setEditValue] = useState("")

  // Active toggles (local state for immediate feedback)
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({})

  // Bulk modal
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkPrices, setBulkPrices] = useState<Record<string, { price: string; minQty: string }>>({})
  const [bulkSaving, setBulkSaving] = useState(false)

  // Price preview
  const [previewRoleId, setPreviewRoleId] = useState("")
  const [previewQty, setPreviewQty] = useState("1")
  const [previewResult, setPreviewResult] = useState<PricingBreakdown | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // ---- Data loading ----

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true)
    try {
      const res = await fetch("/api/roles", { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.roles ?? []
      setRoles(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRoles(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch("/api/products?status=PUBLISHED&take=100", { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const loadRolePrices = useCallback(async (productId: string) => {
    setLoadingPrices(true)
    try {
      const res = await fetch(`/api/pricing/role-prices?productId=${productId}`, { credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      const data = await res.json()
      const list: RolePrice[] = Array.isArray(data) ? data : data.rolePrices ?? []
      setRolePrices(list)
      // Initialize active toggles from loaded data
      const toggles: Record<string, boolean> = {}
      list.forEach((rp) => { toggles[rp.roleId] = rp.isActive })
      setActiveToggles(toggles)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPrices(false)
    }
  }, [])

  useEffect(() => {
    loadRoles()
    loadProducts()
  }, [loadRoles, loadProducts])

  useEffect(() => {
    if (selectedProduct) {
      loadRolePrices(selectedProduct.id)
    } else {
      setRolePrices([])
    }
  }, [selectedProduct, loadRolePrices])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ---- Helpers ----

  const getRolePrice = (roleId: string): RolePrice | undefined => {
    return rolePrices.find((rp) => rp.roleId === roleId)
  }

  const getRoleById = (roleId: string): Role | undefined => {
    return roles.find((r) => r.id === roleId)
  }

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

  // ---- Actions ----

  const handleSaveRow = async (roleId: string) => {
    if (!selectedProduct) return
    const existing = getRolePrice(roleId)
    const price = existing?.price ?? 0
    const minQty = existing?.minQty ?? 1
    const isActive = activeToggles[roleId] ?? existing?.isActive ?? true

    setSavingId(roleId)
    try {
      if (existing) {
        // Update
        const res = await fetch(`/api/pricing/role-prices/${existing.id}`, {
          method: "PUT",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({ price, minQty, isActive }),
        })
        if (res.ok) {
          const data = await res.json()
          setRolePrices((prev) => prev.map((rp) => (rp.id === existing.id ? (data.rolePrice ?? data) : rp)))
        } else {
          const d = await res.json()
          alert(d.message || "Failed to update role price")
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
          const newRp: RolePrice = data.rolePrice ?? data
          setRolePrices((prev) => [...prev, newRp])
        } else {
          const d = await res.json()
          alert(d.message || "Failed to create role price")
        }
      }
    } catch (e) {
      console.error(e)
      alert("Failed to save")
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (roleId: string) => {
    const existing = getRolePrice(roleId)
    if (!existing) return
    if (!confirm("Delete this role price?")) return

    setDeletingId(roleId)
    try {
      const res = await fetch(`/api/pricing/role-prices/${existing.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
      if (res.ok) {
        setRolePrices((prev) => prev.filter((rp) => rp.id !== existing.id))
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

  const handleToggleActive = (roleId: string) => {
    setActiveToggles((prev) => ({ ...prev, [roleId]: !prev[roleId] }))
  }

  // ---- Inline editing ----

  const startEditing = (roleId: string, field: "price" | "minQty") => {
    const existing = getRolePrice(roleId)
    const value = field === "price" ? (existing?.price ?? 0) : (existing?.minQty ?? 1)
    setEditingCell({ rowId: roleId, field })
    setEditValue(String(value))
  }

  const commitEdit = () => {
    if (!editingCell) return
    const { rowId: roleId, field } = editingCell
    const numValue = parseFloat(editValue)
    if (isNaN(numValue) || numValue < 0) {
      setEditingCell(null)
      return
    }

    const existing = getRolePrice(roleId)
    if (existing) {
      setRolePrices((prev) =>
        prev.map((rp) =>
          rp.roleId === roleId ? { ...rp, [field]: field === "minQty" ? Math.round(numValue) : numValue } : rp
        )
      )
    } else {
      // Create a local placeholder so the row can be saved
      const role = getRoleById(roleId)
      const newRp: RolePrice = {
        id: `new-${roleId}`,
        productId: selectedProduct!.id,
        roleId,
        price: field === "price" ? numValue : 0,
        minQty: field === "minQty" ? Math.round(numValue) : 1,
        isActive: activeToggles[roleId] ?? true,
        role: role,
      }
      setRolePrices((prev) => [...prev, newRp])
    }
    setEditingCell(null)
  }

  // ---- Bulk ----

  const openBulkModal = () => {
    const map: Record<string, { price: string; minQty: string }> = {}
    roles.forEach((role) => {
      const existing = getRolePrice(role.id)
      map[role.id] = {
        price: existing ? String(existing.price) : "",
        minQty: existing ? String(existing.minQty) : "1",
      }
    })
    setBulkPrices(map)
    setShowBulkModal(true)
  }

  const handleBulkSave = async () => {
    if (!selectedProduct) return
    setBulkSaving(true)
    try {
      const prices = roles
        .filter((role) => bulkPrices[role.id]?.price !== "")
        .map((role) => ({
          roleId: role.id,
          price: Number(bulkPrices[role.id].price),
          minQty: Number(bulkPrices[role.id].minQty) || 1,
        }))

      const res = await fetch("/api/pricing/role-prices/bulk", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({ productId: selectedProduct.id, prices }),
      })
      if (res.ok) {
        await loadRolePrices(selectedProduct.id)
        setShowBulkModal(false)
      } else {
        const d = await res.json()
        alert(d.message || "Bulk save failed")
      }
    } catch (e) {
      console.error(e)
      alert("Bulk save failed")
    } finally {
      setBulkSaving(false)
    }
  }

  // ---- Price preview ----

  const fetchPreview = useCallback(async () => {
    if (!selectedProduct || !previewRoleId || !previewQty) return
    setPreviewLoading(true)
    try {
      const res = await fetch(
        `/api/pricing/calculate-role?productId=${selectedProduct.id}&quantity=${previewQty}&roleId=${previewRoleId}`,
        { credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } }
      )
      if (res.ok) {
        const data = await res.json()
        setPreviewResult(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPreviewLoading(false)
    }
  }, [selectedProduct, previewRoleId, previewQty])

  useEffect(() => {
    if (selectedProduct && previewRoleId && previewQty) {
      fetchPreview()
    }
  }, [selectedProduct, previewRoleId, previewQty, fetchPreview])

  // ---- Loading state ----

  if (loadingRoles || loadingProducts) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Role-Based Pricing</h1>
        {selectedProduct && (
          <button
            onClick={openBulkModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
          >
            <Plus size={16} />
            Set Prices for All Roles
          </button>
        )}
      </div>

      {/* Product Selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products by title or SKU..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setShowProductDropdown(true)
              }}
              onFocus={() => setShowProductDropdown(true)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {selectedProduct && (
              <button
                onClick={() => {
                  setSelectedProduct(null)
                  setProductSearch("")
                  setRolePrices([])
                  setPreviewResult(null)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {showProductDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p)
                      setProductSearch(p.title)
                      setShowProductDropdown(false)
                      setPreviewResult(null)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition flex items-center justify-between ${
                      selectedProduct?.id === p.id ? "bg-primary-50 text-primary-700" : "text-gray-700"
                    }`}
                  >
                    <span className="font-medium">{p.title}</span>
                    <span className="text-gray-400 text-xs ml-2">
                      {p.sku && `SKU: ${p.sku}`}
                      {p.sku && " | "}
                      {formatPrice(p.unitPrice)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product Info */}
      {selectedProduct && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Product</p>
              <p className="text-base font-semibold text-gray-900">{selectedProduct.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">SKU</p>
              <p className="text-base text-gray-700">{selectedProduct.sku || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Base Price</p>
              <p className="text-base font-semibold text-gray-900">{formatPrice(selectedProduct.unitPrice)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Role Price Table */}
      {selectedProduct && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingPrices ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : roles.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No roles found. Create roles first.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Min Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Active</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {roles.map((role) => {
                  const rp = getRolePrice(role.id)
                  const isActive = activeToggles[role.id] ?? rp?.isActive ?? true
                  const isEditingPrice = editingCell?.rowId === role.id && editingCell?.field === "price"
                  const isEditingMinQty = editingCell?.rowId === role.id && editingCell?.field === "minQty"

                  return (
                    <tr key={role.id} className="hover:bg-gray-50 transition">
                      {/* Role Name + Color Badge */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color || "#6b7280" }}
                          />
                          <span className="font-medium text-gray-900">{role.label || role.name}</span>
                          {role.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium uppercase">
                              System
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
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
                            onClick={() => startEditing(role.id, "price")}
                          >
                            {rp ? formatPrice(rp.price) : <span className="text-gray-400 italic">Not set</span>}
                            <Edit2 size={12} className="text-gray-300" />
                          </span>
                        )}
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
                            onClick={() => startEditing(role.id, "minQty")}
                          >
                            {rp ? rp.minQty : <span className="text-gray-400 italic">1</span>}
                            <Edit2 size={12} className="text-gray-300" />
                          </span>
                        )}
                      </td>

                      {/* Active Toggle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(role.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                            isActive ? "bg-primary-600" : "bg-gray-200"
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
                          <button
                            onClick={() => handleSaveRow(role.id)}
                            disabled={savingId === role.id}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition disabled:opacity-50"
                            title="Save"
                          >
                            {savingId === role.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                            ) : (
                              <Save size={14} />
                            )}
                          </button>
                          {rp && (
                            <button
                              onClick={() => handleDelete(role.id)}
                              disabled={deletingId === role.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingId === role.id ? (
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
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Price Preview */}
      {selectedProduct && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Price Preview</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Select a role and quantity to see the calculated effective price for <span className="font-medium text-gray-700">{selectedProduct.title}</span>.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={previewRoleId}
                onChange={(e) => setPreviewRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={previewQty}
                onChange={(e) => setPreviewQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={fetchPreview}
              disabled={!previewRoleId || !previewQty || previewLoading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {previewLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <DollarSign size={14} />
              )}
              Calculate
            </button>
          </div>

          {previewResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Base Price</p>
                  <p className="text-lg font-semibold text-gray-900">{formatPrice(previewResult.basePrice)}</p>
                </div>
                {previewResult.rolePrice !== undefined && previewResult.rolePrice !== null && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Role Price</p>
                    <p className="text-lg font-semibold text-primary-700">{formatPrice(previewResult.rolePrice)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Effective Price</p>
                  <p className="text-lg font-bold text-green-700">{formatPrice(previewResult.effectivePrice)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Assignment Modal */}
      {showBulkModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Set Prices for All Roles</h2>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
              Product: <span className="font-medium text-gray-700">{selectedProduct.title}</span>
              {" | "}Base Price: <span className="font-medium text-gray-700">{formatPrice(selectedProduct.unitPrice)}</span>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left font-medium text-gray-600">Role</th>
                    <th className="pb-2 text-left font-medium text-gray-600">Price</th>
                    <th className="pb-2 text-left font-medium text-gray-600">Min Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color || "#6b7280" }}
                          />
                          <span className="font-medium text-gray-900">{role.label || role.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price"
                          value={bulkPrices[role.id]?.price ?? ""}
                          onChange={(e) =>
                            setBulkPrices((prev) => ({
                              ...prev,
                              [role.id]: { ...prev[role.id], price: e.target.value },
                            }))
                          }
                          className="w-28 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={bulkPrices[role.id]?.minQty ?? "1"}
                          onChange={(e) =>
                            setBulkPrices((prev) => ({
                              ...prev,
                              [role.id]: { ...prev[role.id], minQty: e.target.value },
                            }))
                          }
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSave}
                disabled={bulkSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {bulkSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {bulkSaving ? "Saving..." : "Save All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}