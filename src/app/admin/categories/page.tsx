"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Edit, X, ChevronRight, ChevronDown, Folder } from "lucide-react"

interface CategoryNode {
  id: string
  name: string
  handle: string
  description: string | null
  parentId: string | null
  children?: CategoryNode[]
  productCount?: number
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
    setShowForm(true)
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
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition"
                style={{ paddingLeft: `${16 + depth * 24}px` }}
              >
                {hasChildren ? (
                  <button onClick={() => toggleExpand(node.id)} className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <span className="w-4" />
                )}
                <Folder size={16} className="text-amber-500" />
                <span className="flex-1 font-medium text-gray-900">{node.name}</span>
                <span className="text-xs text-gray-400 mr-4">/{node.handle}</span>
                <span className="text-xs text-gray-500 mr-4">{node.productCount ?? 0} products</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(node)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(node.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
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
        <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
        <button
          onClick={() => { setShowForm(true); setEditingCategory(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editingCategory ? "Edit Category" : "New Category"}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input required placeholder="Handle (URL slug)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">No Parent (Root)</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">Save</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          {categories.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No categories yet.</p>
          ) : (
            renderTree(categories)
          )}
        </div>
      )}
    </div>
  )
}
