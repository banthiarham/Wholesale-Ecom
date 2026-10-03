"use client"

import { Fragment, useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Search, DollarSign, Plus, Trash2, Save, X, Eye, ChevronDown, ChevronRight, Edit2, Check, Users, ArrowRight, Package, Percent } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"
import RolePriceTable from "@/components/admin/RolePriceTable"

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

interface BulkTierRow {
  id: string
  minQty: string
  prices: Record<string, string>
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

  // Bulk modal
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTiers, setBulkTiers] = useState<BulkTierRow[]>([])
  const [bulkError, setBulkError] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)
  const newTierCounter = useRef(0)
  const [tableReloadKey, setTableReloadKey] = useState(0)

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
      // Role-based pricing applies to purchasing (buyer-side) roles only — ADMIN is staff, not a customer segment.
      setRoles(list.filter((r: Role) => r.name !== "ADMIN"))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRoles(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch("/api/products?status=PUBLISHED&limit=100", { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
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

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

  // ---- Bulk ----

  const openBulkModal = () => {
    const quantities = Array.from(new Set(rolePrices.map((rp) => rp.minQty))).sort((a, b) => a - b)
    const rows = (quantities.length > 0 ? quantities : [1]).map((minQty) => {
      const prices: Record<string, string> = {}
      roles.forEach((role) => {
        const tier = rolePrices.find((rp) => rp.roleId === role.id && rp.minQty === minQty)
        prices[role.id] = tier ? String(tier.price) : ""
      })
      return { id: `bulk-${minQty}-${newTierCounter.current++}`, minQty: String(minQty), prices }
    })
    setBulkTiers(rows)
    setBulkError("")
    setShowBulkModal(true)
  }

  const addBulkTier = () => {
    const quantities = bulkTiers.map((tier) => Number(tier.minQty)).filter(Number.isFinite)
    const nextQty = quantities.length > 0 ? Math.max(...quantities) + 1 : 1
    setBulkTiers((prev) => [
      ...prev,
      {
        id: `bulk-new-${newTierCounter.current++}`,
        minQty: String(nextQty),
        prices: Object.fromEntries(roles.map((role) => [role.id, ""])),
      },
    ])
    setBulkError("")
  }

  const deleteBulkTier = (id: string) => {
    setBulkTiers((prev) => prev.filter((tier) => tier.id !== id))
    setBulkError("")
  }

  const handleBulkSave = async () => {
    if (!selectedProduct) return
    const quantities = bulkTiers.map((tier) => Number(tier.minQty))
    if (quantities.some((qty) => !Number.isInteger(qty) || qty < 1)) {
      setBulkError("Minimum quantity must be a whole number of 1 or more.")
      return
    }
    if (new Set(quantities).size !== quantities.length) {
      setBulkError("Duplicate minimum quantities are not allowed.")
      return
    }
    if (quantities.some((qty, index) => index > 0 && qty <= quantities[index - 1])) {
      setBulkError("Quantity tiers must be entered in ascending order.")
      return
    }

    const prices = bulkTiers.flatMap((tier) =>
      roles
        .filter((role) => tier.prices[role.id] !== "")
        .map((role) => ({
          roleId: role.id,
          price: Number(tier.prices[role.id]),
          minQty: Number(tier.minQty),
        }))
    )
    if (prices.some((entry) => !Number.isFinite(entry.price) || entry.price < 0)) {
      setBulkError("Every entered role price must be zero or greater.")
      return
    }

    setBulkSaving(true)
    setBulkError("")
    try {
      const res = await fetch("/api/pricing/role-prices/bulk", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({ productId: selectedProduct.id, prices, replaceExisting: true }),
      })
      if (res.ok) {
        await loadRolePrices(selectedProduct.id)
        setTableReloadKey((k) => k + 1)
        setShowBulkModal(false)
      } else {
        const d = await res.json()
        setBulkError(d.message || "Bulk save failed")
      }
    } catch (e) {
      console.error(e)
      setBulkError("Bulk save failed")
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
    return <SkeletonTable rows={4} cols={5} />
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Role-Based Pricing</h1>
        <div className="admin-card-static p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={26} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">No products found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Add and publish products before setting up role-based pricing.</p>
          <Link href="/admin/products" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
            Go to Products <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Role-Based Pricing</h1>
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
      <div className="admin-card-static p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Product</label>
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search products by title or SKU..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setShowProductDropdown(true)
              }}
              onFocus={() => setShowProductDropdown(true)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {selectedProduct && (
              <button
                onClick={() => {
                  setSelectedProduct(null)
                  setProductSearch("")
                  setRolePrices([])
                  setPreviewResult(null)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {showProductDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No products found</div>
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
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30 transition flex items-center justify-between ${
                      selectedProduct?.id === p.id ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span className="font-medium">{p.title}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">
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
        <div className="admin-card-static p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Product</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{selectedProduct.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">SKU</p>
              <p className="text-base text-gray-700 dark:text-gray-300">{selectedProduct.sku || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Base Price</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatPrice(selectedProduct.unitPrice)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Role Price Table (shared with the product edit form) */}
      {selectedProduct && (
        <RolePriceTable
          product={selectedProduct}
          reloadKey={tableReloadKey}
          onChange={() => loadRolePrices(selectedProduct.id)}
        />
      )}

      {/* Price Preview */}
      {selectedProduct && (
        <div className="admin-card-static p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Price Preview</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Select a role and quantity to see the calculated effective price for <span className="font-medium text-gray-700 dark:text-gray-300">{selectedProduct.title}</span>.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
              <select
                value={previewRoleId}
                onChange={(e) => setPreviewRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={previewQty}
                onChange={(e) => setPreviewQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Base Price</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatPrice(previewResult.basePrice)}</p>
                </div>
                {previewResult.rolePrice !== undefined && previewResult.rolePrice !== null && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Role Price</p>
                    <p className="text-lg font-semibold text-primary-700 dark:text-primary-400">{formatPrice(previewResult.rolePrice)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Effective Price</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatPrice(previewResult.effectivePrice)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Assignment Modal */}
      {showBulkModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Set Prices for All Roles</h2>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
              Product: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedProduct.title}</span>
              {" | "}Base Price: <span className="font-medium text-gray-700 dark:text-gray-300">{formatPrice(selectedProduct.unitPrice)}</span>
              {" — "}set quantity-based prices for every role in one matrix.
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Each row is one minimum-quantity tier.</p>
                <button
                  type="button"
                  onClick={addBulkTier}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-medium hover:bg-primary-50 dark:hover:bg-primary-900/30 transition"
                >
                  <Plus size={14} /> Add Tier
                </button>
              </div>
              {bulkError && (
                <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  {bulkError}
                </div>
              )}
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-2 pr-3 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Min Qty</th>
                    {roles.map((role) => (
                      <th key={role.id} className="pb-2 px-2 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {role.label || role.name} Price
                      </th>
                    ))}
                    <th className="pb-2 pl-2 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {bulkTiers.map((tier) => (
                    <tr key={tier.id}>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          aria-label="Minimum quantity"
                          value={tier.minQty}
                          onChange={(e) =>
                            setBulkTiers((prev) => prev.map((row) => row.id === tier.id ? { ...row, minQty: e.target.value } : row))
                          }
                          className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      {roles.map((role) => (
                        <td key={role.id} className="py-2.5 px-2">
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Price"
                              aria-label={`${role.label || role.name} price at ${tier.minQty}+`}
                              value={tier.prices[role.id] ?? ""}
                              onChange={(e) =>
                                setBulkTiers((prev) => prev.map((row) => row.id === tier.id
                                  ? { ...row, prices: { ...row.prices, [role.id]: e.target.value } }
                                  : row))
                              }
                              className="w-full pl-6 pr-2 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </td>
                      ))}
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteBulkTier(tier.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                          title="Delete tier"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {bulkTiers.length === 0 && (
                    <tr>
                      <td colSpan={roles.length + 2} className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        No tiers. Select Add Tier to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
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
