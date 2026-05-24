"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Trash2, Edit, Plus, X, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Product {
  id: string
  title: string
  handle: string
  sku: string | null
  thumbnail: string | null
  unitPrice: number
  compareAtPrice: number | null
  moq: number
  inventoryQuantity: number
  status: string
  vendorName: string | null
}

interface Category {
  id: string
  name: string
  handle: string
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const emptyForm = {
    title: "",
    sku: "",
    description: "",
    unitPrice: "",
    compareAtPrice: "",
    moq: "1",
    inventoryQuantity: "0",
    categoryId: "",
    status: "ACTIVE",
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [token])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.vendorName?.toLowerCase().includes(q)
      )
    )
  }, [products, search])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setProducts(data.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      const cats: Category[] = []
      const flatten = (arr: any[]) => {
        for (const c of arr || []) {
          cats.push({ id: c.id, name: c.name, handle: c.handle })
          flatten(c.children)
        }
      }
      flatten(data.categories || [])
      setCategories(cats)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      ...form,
      unitPrice: Number(form.unitPrice),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
      moq: Number(form.moq),
      inventoryQuantity: Number(form.inventoryQuantity),
    }
    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } else {
        await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      }
      setShowForm(false)
      setEditingProduct(null)
      setForm(emptyForm)
      loadProducts()
    } catch (err) {
      console.error(err)
      alert("Failed to save product")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return
    try {
      await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error(err)
      alert("Failed to delete product")
    }
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({
      title: p.title,
      sku: p.sku || "",
      description: "",
      unitPrice: String(p.unitPrice),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
      moq: String(p.moq),
      inventoryQuantity: String(p.inventoryQuantity),
      categoryId: "",
      status: p.status,
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
          />
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingProduct(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editingProduct ? "Edit Product" : "New Product"}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input required type="number" step="0.01" placeholder="Unit Price" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="number" step="0.01" placeholder="Compare At Price" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input required type="number" placeholder="MOQ" value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input required type="number" placeholder="Inventory" value={form.inventoryQuantity} onChange={(e) => setForm({ ...form, inventoryQuantity: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Select Category</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ARCHIVED">ARCHIVED</option>
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
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                          {p.thumbnail ? (
                            <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <Link href={`/products/${p.handle}`} className="font-medium text-gray-900 hover:text-primary-600">{p.title}</Link>
                          {p.vendorName && <p className="text-xs text-gray-500">{p.vendorName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.sku || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{formatPrice(Number(p.unitPrice))}</span>
                      {p.compareAtPrice && <span className="text-xs text-gray-400 line-through ml-1">{formatPrice(Number(p.compareAtPrice))}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${p.inventoryQuantity > 0 ? "text-green-600" : "text-red-600"}`}>
                        {p.inventoryQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                        p.status === "ACTIVE" ? "bg-green-50 text-green-700" : p.status === "DRAFT" ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
