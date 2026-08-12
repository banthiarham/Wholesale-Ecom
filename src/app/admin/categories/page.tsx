"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Edit, X, ChevronRight, ChevronDown, Folder } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface CategoryNode {
  id: string
  name: string
  handle: string
  description: string | null
  parentId: string | null
  children?: CategoryNode[]
  _count?: { products: number }
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [flatCats, setFlatCats] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const emptyForm = { name: "", handle: "", description: "", parentId: "" }
  const [form, setForm] = useState(emptyForm)
  const [bulkPercent, setBulkPercent] = useState("")
  const [applyingPrice, setApplyingPrice] = useState(false)

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
    const body = { ...form, description: form.description || null, parentId: form.parentId || null }
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
    })
    setBulkPercent("")
    setShowForm(true)
  }

  const handleAdjustPrice = async () => {
    if (!editingCategory) return
    const percentage = parseFloat(bulkPercent)
    if (Number.isNaN(percentage) || percentage === 0) {
      alert("Enter a non-zero percentage, e.g. 10 or -15")
      return
    }
    const direction = percentage > 0 ? "increase" : "decrease"
    if (!confirm(`This will ${direction} the price of every product in "${editingCategory.name.trim()}" by ${Math.abs(percentage)}%. This cannot be undone. Continue?`)) return

    setApplyingPrice(true)
    try {
      const res = await fetch(`/api/categories/${editingCategory.id}/adjust-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ percentage }),
      })
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      alert(`Updated price for ${data.updatedCount} product(s).`)
      setBulkPercent("")
    } catch (err) {
      console.error(err)
      alert("Failed to adjust product prices")
    } finally {
      setApplyingPrice(false)
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
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            <input required placeholder="Handle (URL slug)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
              <option value="">No Parent (Root)</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">Save</button>
            </div>
          </form>

          {editingCategory && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">Bulk Price Adjustment</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Adjust the price of every product in this category by a percentage. This updates product prices immediately and cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <div className="relative w-40">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10 or -15"
                    value={bulkPercent}
                    onChange={(e) => setBulkPercent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <button
                  type="button"
                  onClick={handleAdjustPrice}
                  disabled={applyingPrice || !bulkPercent}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {applyingPrice ? "Applying..." : "Apply to all products"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
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
