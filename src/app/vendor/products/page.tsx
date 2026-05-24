"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Package, Plus, X } from "lucide-react"

interface Product {
  id: string
  title: string
  sku: string | null
  unitPrice: number
  inventoryQuantity: number
  reservedQuantity: number
  moq: number
  status: string
  category?: { name: string }
}

interface Category {
  id: string
  name: string
  handle: string
}

export default function VendorProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const emptyForm = {
    title: "",
    handle: "",
    description: "",
    sku: "",
    unitPrice: "",
    compareAtPrice: "",
    moq: "1",
    inventoryQuantity: "0",
    categoryId: "",
    status: "PUBLISHED",
    vendorName: "",
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!token) { router.push("/login"); return }
    loadProducts()
    loadCategories()
    if (searchParams.get("action") === "add") setShowForm(true)
  }, [router, token, searchParams])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/vendor/products", { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setProducts(Array.isArray(d) ? d : [])
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
    const body: any = {
      ...form,
      unitPrice: Number(form.unitPrice),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      moq: Number(form.moq),
      inventoryQuantity: Number(form.inventoryQuantity),
    }
    if (!body.compareAtPrice) delete body.compareAtPrice
    if (!body.categoryId) delete body.categoryId
    if (!body.sku) delete body.sku
    if (!body.description) delete body.description

    try {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      setShowForm(false)
      setForm(emptyForm)
      loadProducts()
    } catch (err) {
      console.error(err)
      alert("Failed to add product")
    }
  }

  const generateHandle = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/vendor/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-primary-600">
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          <button
            onClick={() => { setShowForm(true); setForm(emptyForm) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Add New Product</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                required
                placeholder="Product Title"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value
                  setForm({ ...form, title, handle: generateHandle(title) })
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                required
                placeholder="URL Handle (auto-generated)"
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                placeholder="Vendor Name"
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                required
                type="number"
                step="0.01"
                placeholder="Unit Price (₹)"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Compare At Price (₹)"
                value={form.compareAtPrice}
                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                required
                type="number"
                placeholder="MOQ (Minimum Order Quantity)"
                value={form.moq}
                onChange={(e) => setForm({ ...form, moq: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                required
                type="number"
                placeholder="Inventory Quantity"
                value={form.inventoryQuantity}
                onChange={(e) => setForm({ ...form, inventoryQuantity: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm h-24 resize-none"
              />
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <Package size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No products found.</p>
            <button
              onClick={() => { setShowForm(true); setForm(emptyForm) }}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              Add Your First Product
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">MOQ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 text-gray-600">{p.sku || "-"}</td>
                    <td className="px-4 py-3">₹{Number(p.unitPrice).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">{p.inventoryQuantity - p.reservedQuantity} / {p.inventoryQuantity}</td>
                    <td className="px-4 py-3">{p.moq}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          p.status === "PUBLISHED"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
