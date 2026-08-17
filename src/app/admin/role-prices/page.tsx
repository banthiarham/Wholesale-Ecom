"use client"

import { Fragment, useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Search, DollarSign, Plus, Trash2, Save, X, Eye, ChevronDown, ChevronRight, Edit2, Check, Users, ArrowRight, Package, Percent } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"

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

  // Bulk modal
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTiers, setBulkTiers] = useState<BulkTierRow[]>([])
  const [bulkError, setBulkError] = useState("")
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

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

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

      {/* Role Price Table */}
      {selectedProduct && (
        <div className="admin-card-static overflow-hidden">
          {loadingPrices ? (
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
