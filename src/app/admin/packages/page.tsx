"use client"

import { useEffect, useState, useRef } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  GripVertical,
  Layers,
  Package,
  Save,
  Loader2,
} from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import SearchableSelect from "@/components/admin/SearchableSelect"

interface PackageGroup {
  id?: string
  name: string
  description?: string
  required: boolean
  minSelect: number
  maxSelect: number
  sortOrder: number
  discountType?: string
  discountValue?: number
  maxDiscount?: number
  categoryId?: string
  productIds?: string[]
  defaultProductId?: string
}

interface PackageTemplate {
  id: string
  title: string
  handle: string
  description?: string
  basePrice: number
  thumbnail?: string
  images: string[]
  status: string
  tags: string[]
  groups: any[]
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  handle: string
}

interface Product {
  id: string
  title: string
  handle: string
  unitPrice: string
  thumbnail?: string
  status: string
}

const emptyGroup: PackageGroup = {
  name: "",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  sortOrder: 0,
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<PackageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [description, setDescription] = useState("")
  const [basePrice, setBasePrice] = useState(0)
  const [status, setStatus] = useState("DRAFT")
  const [groups, setGroups] = useState<PackageGroup[]>([{ ...emptyGroup }])

  // Lookup data
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    loadPackages()
    loadLookupData()
  }, [])

  const getToken = () => localStorage.getItem("token")

  const loadPackages = async () => {
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch("/api/packages", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPackages(data.packages || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadLookupData = async () => {
    try {
      const token = getToken()
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/categories", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products?status=PUBLISHED,DRAFT&limit=500", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const catData = await catRes.json()
      const prodData = await prodRes.json()
      setCategories(catData.categories || catData || [])
      setProducts(prodData.products || [])
    } catch (err) {
      console.error(err)
    }
  }

  const generateHandle = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!editingId) setHandle(generateHandle(val))
  }

  const resetForm = () => {
    setTitle("")
    setHandle("")
    setDescription("")
    setBasePrice(0)
    setStatus("DRAFT")
    setGroups([{ ...emptyGroup }])
    setEditingId(null)
    setShowForm(false)
    setError("")
  }

  const handleEdit = (pkg: PackageTemplate) => {
    setTitle(pkg.title)
    setHandle(pkg.handle)
    setDescription(pkg.description || "")
    setBasePrice(Number(pkg.basePrice))
    setStatus(pkg.status)
    setGroups(
      pkg.groups.map((g: any) => ({
        name: g.name,
        description: g.description,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sortOrder: g.sortOrder,
        discountType: g.discountType,
        discountValue: g.discountValue ? Number(g.discountValue) : undefined,
        maxDiscount: g.maxDiscount ? Number(g.maxDiscount) : undefined,
        categoryId: g.categoryId || undefined,
        productIds: g.products?.map((p: any) => p.productId || p.id) || [],
        defaultProductId: g.products?.find((p: any) => p.isDefault)?.productId || undefined,
      }))
    )
    setEditingId(pkg.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!title || !handle) {
      setError("Title and handle are required")
      return
    }
    if (groups.some((g) => !g.name)) {
      setError("All groups must have a name")
      return
    }

    setSaving(true)
    setError("")
    try {
      const token = getToken()
      const body = {
        title,
        handle,
        description: description || undefined,
        basePrice,
        status,
        groups: groups.map((g, i) => ({
          name: g.name,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: i,
          description: g.description || undefined,
          categoryId: g.categoryId || undefined,
          productIds: g.categoryId ? undefined : (g.productIds?.length ? g.productIds : undefined),
          discountType: g.discountType || undefined,
          discountValue: g.discountType ? g.discountValue : undefined,
          maxDiscount: g.discountType === "PERCENTAGE" ? g.maxDiscount : undefined,
          defaultProductId: g.defaultProductId || undefined,
        })),
      }

      const res = await fetch(
        editingId ? `/api/packages/${editingId}` : "/api/packages",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to save package")
      }

      await loadPackages()
      resetForm()
    } catch (err: any) {
      setError(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this package template?")) return
    try {
      const token = getToken()
      await fetch(`/api/packages/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      await loadPackages()
    } catch (err) {
      console.error(err)
    }
  }

  const updateGroup = (index: number, updates: Partial<PackageGroup>) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...updates } : g)))
  }

  const removeGroup = (index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index))
  }

  const addGroup = () => {
    setGroups((prev) => [...prev, { ...emptyGroup, name: `Group ${prev.length + 1}`, sortOrder: prev.length }])
  }

  const moveGroup = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= groups.length) return
    setGroups((prev) => {
      const arr = [...prev]
      ;[arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]
      return arr.map((g, i) => ({ ...g, sortOrder: i }))
    })
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "PUBLISHED": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      case "DRAFT": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "ARCHIVED": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  if (loading) return <SkeletonTable rows={4} cols={5} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Package Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create configurable product packages with component groups</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
        >
          <Plus size={16} /> Create Package
        </button>
      </div>

      {/* Package List */}
      {packages.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Layers size={28} className="text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No package templates yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a package to let customers configure their own products</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Handle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Base Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Groups</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{pkg.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">{pkg.handle}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">₹{Number(pkg.basePrice).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{pkg.groups?.length || 0} groups</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(pkg.status)}`}>
                      {pkg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(pkg)} className="text-primary-600 dark:text-primary-400 hover:underline text-sm mr-3">Edit</button>
                    <button onClick={() => handleDelete(pkg.id)} className="text-red-600 dark:text-red-400 hover:underline text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingId ? "Edit Package" : "Create Package"}</h2>
            <button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" placeholder="Custom Desktop PC" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Handle *</label>
              <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" placeholder="custom-desktop-pc" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Price (₹)</label>
              <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" min={0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" rows={3} placeholder="Optional package description..." />
            </div>
          </div>

          {/* Groups */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Component Groups</h3>
              <button onClick={addGroup} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition">
                <Plus size={14} /> Add Group
              </button>
            </div>

            <div className="space-y-4">
              {groups.map((group, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{index + 1}</span>
                      <input type="text" value={group.name} onChange={(e) => updateGroup(index, { name: e.target.value })} className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm font-medium text-gray-900 dark:text-gray-100 dark:bg-gray-800 w-40" placeholder="Group name" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveGroup(index, "up")} disabled={index === 0} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30">
                        <ChevronUp size={16} />
                      </button>
                      <button onClick={() => moveGroup(index, "down")} disabled={index === groups.length - 1} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30">
                        <ChevronDown size={16} />
                      </button>
                      <button onClick={() => removeGroup(index)} className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-400 ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={group.required} onChange={(e) => updateGroup(index, { required: e.target.checked })} className="rounded border-gray-300 dark:border-gray-700" />
                      <span className="text-gray-700 dark:text-gray-300">Required</span>
                    </label>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Min Select</label>
                      <input type="number" value={group.minSelect} onChange={(e) => updateGroup(index, { minSelect: Number(e.target.value) })} className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm dark:bg-gray-800 dark:text-gray-100" min={1} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Max Select</label>
                      <input type="number" value={group.maxSelect} onChange={(e) => updateGroup(index, { maxSelect: Number(e.target.value) })} className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm dark:bg-gray-800 dark:text-gray-100" min={1} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Category</label>
                      <SearchableSelect
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                        value={group.categoryId || ""}
                        onChange={(value) => updateGroup(index, { categoryId: value || undefined, productIds: value ? undefined : group.productIds })}
                        placeholder="— Select category —"
                      />
                    </div>
                  </div>

                  {/* Product selection (only when no category) */}
                  {!group.categoryId && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Products (select multiple)</label>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                        {products.filter((p) => p.status === "PUBLISHED" || p.status === "DRAFT").map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(group.productIds || []).includes(p.id)}
                              onChange={(e) => {
                                const current = group.productIds || []
                                updateGroup(index, {
                                  productIds: e.target.checked ? [...current, p.id] : current.filter((id) => id !== p.id),
                                })
                              }}
                              className="rounded border-gray-300 dark:border-gray-700"
                            />
                            <span className="text-gray-900 dark:text-gray-100 truncate">{p.title}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">₹{Number(p.unitPrice).toLocaleString("en-IN")}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discount section */}
                  <details className="text-sm">
                    <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Group Discount (optional)</summary>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
                        <select value={group.discountType || ""} onChange={(e) => updateGroup(index, { discountType: e.target.value || undefined, discountValue: e.target.value ? group.discountValue : undefined, maxDiscount: e.target.value ? group.maxDiscount : undefined })} className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm dark:bg-gray-800 dark:text-gray-100">
                          <option value="">None</option>
                          <option value="PERCENTAGE">Percentage</option>
                          <option value="FLAT">Flat</option>
                        </select>
                      </div>
                      {group.discountType && (
                        <>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Value</label>
                            <input type="number" value={group.discountValue || ""} onChange={(e) => updateGroup(index, { discountValue: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm dark:bg-gray-800 dark:text-gray-100" />
                          </div>
                          {group.discountType === "PERCENTAGE" && (
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400">Max Discount (₹)</label>
                              <input type="number" value={group.maxDiscount || ""} onChange={(e) => updateGroup(index, { maxDiscount: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm dark:bg-gray-800 dark:text-gray-100" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition text-sm font-medium">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingId ? "Update Package" : "Create Package"}
            </button>
            <button onClick={resetForm} className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm text-gray-700 dark:text-gray-300 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}