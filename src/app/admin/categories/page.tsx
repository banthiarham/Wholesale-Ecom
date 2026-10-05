"use client"

import { FormField } from "@/components/admin/FormField"

import { useEffect, useState } from "react"
import { Plus, Trash2, Edit, X, ChevronRight, ChevronDown, Folder, Tag, ImagePlus } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { ProductFilterBar, ProductFilterState, SortKey, applyProductFilters, defaultFilters } from "@/components/admin/ProductFilters"

interface CategoryNode {
  id: string
  name: string
  handle: string
  description: string | null
  image?: string | null
  parentId: string | null
  children?: CategoryNode[]
  _count?: { products: number }
}

interface RoleLite {
  id: string
  name: string
  label: string
  color: string
}

interface CategoryProduct {
  id: string
  title: string
  unitPrice: number
  compareAtPrice?: number | null
  inventoryQuantity: number
  reservedQuantity?: number
  status: string
  tierPrices?: unknown[]
  rating?: number
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [flatCats, setFlatCats] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const emptyForm = { name: "", handle: "", description: "", parentId: "", image: "" }
  const [form, setForm] = useState(emptyForm)
  // Role pricing for the category being edited: one % / Rs. pair per role (only one of the two may be filled).
  const [roles, setRoles] = useState<RoleLite[]>([])
  const [adjust, setAdjust] = useState<Record<string, { pct: string; amt: string }>>({})
  const [savingRoles, setSavingRoles] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [catProducts, setCatProducts] = useState<CategoryProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [prodFilters, setProdFilters] = useState<ProductFilterState>(defaultFilters)
  const [prodSort, setProdSort] = useState<SortKey>("default")
  const visibleCatProducts = applyProductFilters(catProducts, prodFilters, prodSort)

  useEffect(() => {
    loadCategories()
  }, [token])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      setCategories(data.categories || [])

      const flat: CategoryNode[] = []
      const flatten = (arr: CategoryNode[], depth = 0) => {
        for (const c of arr || []) {
          flat.push({ ...c, name: "  ".repeat(depth) + c.name })
          flatten(c.children || [], depth + 1)
        }
      }
      flatten(data.categories || [])
      setFlatCats(flat)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = { ...form, description: form.description || null, parentId: form.parentId || null, image: form.image }
    try {
      if (editingCategory) {
        await fetch(`/api/categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } else {
        await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      }
      setShowForm(false)
      setEditingCategory(null)
      setForm(emptyForm)
      loadCategories()
    } catch (err) {
      console.error(err)
      alert("Failed to save category")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return
    try {
      await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      loadCategories()
    } catch (err) {
      console.error(err)
      alert("Failed to delete category")
    }
  }

  const openEdit = (c: CategoryNode) => {
    setEditingCategory(c)
    setForm({
      name: c.name.trim(),
      handle: c.handle,
      description: c.description || "",
      parentId: c.parentId || "",
      image: c.image || "",
    })
    setAdjust({})
    setShowForm(true)
    loadRoles()
    loadCategoryProducts(c.id)
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) { alert("Please choose an image file (JPG, PNG, WebP).") ; return }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be 5 MB or smaller."); return }
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/categories/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Upload failed")
      setForm((f) => ({ ...f, image: data.url }))
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to upload image")
    } finally {
      setUploadingImage(false)
    }
  }

  const loadRoles = async () => {
    try {
      const res = await fetch("/api/roles", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const list: RoleLite[] = Array.isArray(data) ? data : data.roles ?? []
      // Role pricing is for buyer-side roles only — ADMIN is staff.
      setRoles(list.filter((r) => r.name !== "ADMIN"))
    } catch (err) {
      console.error(err)
    }
  }

  const loadCategoryProducts = async (categoryId: string) => {
    setLoadingProducts(true)
    setCatProducts([])
    setProdFilters(defaultFilters)
    setProdSort("default")
    try {
      const res = await fetch(`/api/products?category=${categoryId}&status=PUBLISHED,DRAFT,ARCHIVED&limit=2000`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setCatProducts(Array.isArray(data) ? data : data.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingProducts(false)
    }
  }

  const setAdjustField = (roleId: string, field: "pct" | "amt", value: string) =>
    setAdjust((prev) => ({ ...prev, [roleId]: { ...(prev[roleId] || { pct: "", amt: "" }), [field]: value } }))

  // One Save for the whole table: every role with a value filled in is sent together and applied
  // all-or-nothing by the backend.
  const handleSaveRoleAdjust = async () => {
    if (!editingCategory) return
    const entries = roles
      .map((role) => {
        const e = adjust[role.id] || { pct: "", amt: "" }
        const usingPct = e.pct.trim() !== ""
        const raw = usingPct ? e.pct : e.amt
        if (raw.trim() === "") return null
        return { role, usingPct, value: parseFloat(raw) }
      })
      .filter((x): x is { role: RoleLite; usingPct: boolean; value: number } => x !== null)

    if (entries.length === 0) {
      alert("Enter a percentage or amount for at least one role.")
      return
    }
    if (entries.some((x) => Number.isNaN(x.value) || x.value === 0)) {
      alert("Each change must be a non-zero number, e.g. 10 or -15.")
      return
    }
    const summary = entries
      .map((x) => `${x.role.label || x.role.name}: ${x.value > 0 ? "+" : "-"}${x.usingPct ? `${Math.abs(x.value)}%` : `₹${Math.abs(x.value)}`}`)
      .join("\n")
    if (!confirm(`Apply these changes to the existing role prices (every quantity tier) of all products in "${editingCategory.name.trim()}"?\n\n${summary}`)) return

    setSavingRoles(true)
    try {
      const res = await fetch(`/api/categories/${editingCategory.id}/role-price-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          adjustments: entries.map((x) => ({ roleId: x.role.id, ...(x.usingPct ? { percentage: x.value } : { amount: x.value }) })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Failed to update role prices")
        return
      }
      alert(`Updated ${data.updatedCount} price(s) across ${data.productCount} product(s).`)
      setAdjust({})
    } catch (err) {
      console.error(err)
      alert("Failed to update role prices")
    } finally {
      setSavingRoles(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderTree = (nodes: CategoryNode[], depth = 0) => {
    return (
      <>
        {nodes.map((node) => {
          const hasChildren = (node.children?.length ?? 0) > 0
          const isExpanded = expanded.has(node.id)
          return (
            <div key={node.id}>
              <div
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                style={{ paddingLeft: `${16 + depth * 24}px` }}
              >
                {hasChildren ? (
                  <button onClick={() => toggleExpand(node.id)} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <span className="w-4" />
                )}
                <Folder size={16} className="text-amber-500" />
                <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{node.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mr-4">/{node.handle}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mr-4">{node._count?.products ?? 0} products</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(node)} className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(node.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
                </div>
              </div>
              {hasChildren && isExpanded && renderTree(node.children || [], depth + 1)}
            </div>
          )
        })}
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Categories</h2>
        <button
          onClick={() => { setShowForm(true); setEditingCategory(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {showForm && (
        <div className="admin-card-static p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{editingCategory ? "Edit Category" : "New Category"}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Category Name" required>
              <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </FormField>
            <FormField label="Handle (URL slug)" required hint="Web address of the category page">
              <input required placeholder="Handle (URL slug)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </FormField>
            <FormField label="Parent Category">
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
              <option value="">No Parent (Root)</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            </FormField>
            <FormField label="Description" className="sm:col-span-2 lg:col-span-3">
              <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </FormField>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category Image</label>
              <div className="flex items-center gap-3">
                {form.image ? (
                  <div className="relative w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden group bg-gray-50 dark:bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image} alt="Category" className="w-full h-full object-contain" />
                    <button type="button" onClick={() => setForm({ ...form, image: "" })} className="absolute top-0.5 right-0.5 bg-white dark:bg-gray-800 rounded-full p-0.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition shadow-sm" aria-label="Remove image"><X size={12} /></button>
                  </div>
                ) : null}
                <label className={`w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                  <ImagePlus size={20} />
                  {uploadingImage ? "Uploading..." : form.image ? "Replace" : "Add image"}
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Shown to all users on the Categories page and in the home page category widgets. JPG, PNG or WebP, up to 5 MB. Click Save to apply.</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">Save</button>
            </div>
          </form>

          {editingCategory && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">Role Pricing</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Raise or lower a role&apos;s existing prices for every product in this category, by a percentage or a flat amount (use a minus sign to decrease). Fill only one of the two fields per role.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Role</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Price Change (%)</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Price Change (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {roles.map((role) => {
                      const entry = adjust[role.id] || { pct: "", amt: "" }
                      const inputCls = "w-36 px-3 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      return (
                        <tr key={role.id}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: role.color || "#6b7280" }} />
                              <span className="font-medium text-gray-900 dark:text-gray-100">{role.label || role.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 10 or -15"
                              value={entry.pct}
                              disabled={entry.amt.trim() !== ""}
                              onChange={(e) => setAdjustField(role.id, "pct", e.target.value)}
                              className={inputCls}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 100 or -50"
                              value={entry.amt}
                              disabled={entry.pct.trim() !== ""}
                              onChange={(e) => setAdjustField(role.id, "amt", e.target.value)}
                              className={inputCls}
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {roles.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No buyer roles found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleSaveRoleAdjust}
                  disabled={savingRoles || roles.length === 0 || roles.every((r) => !(adjust[r.id]?.pct.trim() || adjust[r.id]?.amt.trim()))}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {savingRoles ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && editingCategory ? (
        <div className="admin-card-static overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100">
            Products in {editingCategory.name.trim()} {!loadingProducts && <span className="text-gray-400 dark:text-gray-500 font-normal">({catProducts.length})</span>}
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">To change a product, use the Products module.</span>
          </div>
          {!loadingProducts && catProducts.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <ProductFilterBar filters={prodFilters} onFilters={setProdFilters} sort={prodSort} onSort={setProdSort} showCategory={false} resultCount={visibleCatProducts.length} totalCount={catProducts.length} />
            </div>
          )}
          {loadingProducts ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading products...</p>
          ) : catProducts.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">No products in this category.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Product</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Price</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Stock</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Tiers</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {visibleCatProducts.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No products match the selected filters.</td></tr>
                  )}
                  {visibleCatProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.title}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(p.unitPrice)}</span>
                        {p.compareAtPrice ? <span className="text-xs text-gray-400 dark:text-gray-500 line-through ml-1">{formatPrice(p.compareAtPrice)}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.inventoryQuantity - (p.reservedQuantity || 0)}/{p.inventoryQuantity}</td>
                      <td className="px-4 py-3">
                        {p.tierPrices && p.tierPrices.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                            <Tag size={12} /> {p.tierPrices.length}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "PUBLISHED" || p.status === "ACTIVE" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                          p.status === "DRAFT" ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <SkeletonTable />
      ) : (
        <div className="admin-card-static">
          {categories.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">No categories yet.</p>
          ) : (
            renderTree(categories)
          )}
        </div>
      )}
    </div>
  )
}
