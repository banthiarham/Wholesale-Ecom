"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Package, Plus, X, Edit, Trash2, ImagePlus } from "lucide-react"

interface Product {
  id: string
  title: string
  handle: string
  sku: string | null
  description: string | null
  unitPrice: number
  compareAtPrice: number | null
  inventoryQuantity: number
  reservedQuantity: number
  moq: number
  status: string
  categoryId: string | null
  category?: { name: string }
  thumbnail: string | null
  images: string[]
}

interface Category {
  id: string
  name: string
  handle: string
}

function VendorProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
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
    setUploading(true)
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
      let productId = editingProduct?.id
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        productId = data.id
      }

      if (imageFiles.length > 0 && productId) {
        const formData = new FormData()
        imageFiles.forEach((f) => formData.append("images", f))
        await fetch(`/api/products/${productId}/images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
      }

      setShowForm(false)
      setEditingProduct(null)
      setForm(emptyForm)
      setImageFiles([])
      setImagePreviews([])
      loadProducts()
    } catch (err) {
      console.error(err)
      alert(editingProduct ? "Failed to update product" : "Failed to add product")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This action cannot be undone.")) return
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id))
      } else {
        const data = await res.json()
        alert(data.message || "Failed to delete product")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to delete product")
    }
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({
      title: p.title,
      handle: p.handle || "",
      description: p.description || "",
      sku: p.sku || "",
      unitPrice: String(p.unitPrice),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
      moq: String(p.moq),
      inventoryQuantity: String(p.inventoryQuantity),
      categoryId: p.categoryId || "",
      status: p.status,
    })
    setImageFiles([])
    setImagePreviews((p.images || []).map((img) => img))
    setShowForm(true)
  }

  const openAdd = () => {
    setEditingProduct(null)
    setForm(emptyForm)
    setImageFiles([])
    setImagePreviews([])
    setShowForm(true)
  }

  const generateHandle = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = 5 - (editingProduct ? (editingProduct.images?.length || 0) : 0)
    const toAdd = files.slice(0, Math.max(0, remaining - imageFiles.length))
    if (toAdd.length === 0) { alert("Maximum 5 images per product"); return }
    setImageFiles((prev) => [...prev, ...toAdd])
    const newPreviews = toAdd.map((f) => URL.createObjectURL(f))
    setImagePreviews((prev) => [...prev, ...newPreviews])
    e.target.value = ""
  }

  const removeNewImage = (index: number) => {
    const offset = editingProduct ? (editingProduct.images?.length || 0) : 0
    if (index < offset) return
    const fileIndex = index - offset
    const url = imagePreviews[index]
    if (url.startsWith("blob:")) URL.revokeObjectURL(url)
    setImageFiles((prev) => prev.filter((_, i) => i !== fileIndex))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
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
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{editingProduct ? "Edit Product" : "Add New Product"}</h3>
              <button onClick={() => { setShowForm(false); setEditingProduct(null); setForm(emptyForm); setImageFiles([]); setImagePreviews([]) }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                required
                placeholder="Product Title"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value
                  setForm({ ...form, title, handle: editingProduct ? form.handle : generateHandle(title) })
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                placeholder="URL Handle"
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
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (max 5)</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden group">
                      <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.length < 5 && (
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition">
                      <ImagePlus size={20} className="text-gray-400" />
                      <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500">Click the + button to add images. Supports JPG, PNG, WebP.</p>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingProduct(null); setForm(emptyForm); setImageFiles([]); setImagePreviews([]) }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
                >
                  {uploading ? "Saving..." : editingProduct ? "Save Changes" : "Add Product"}
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
              onClick={openAdd}
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Image</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">MOQ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        {p.thumbnail || (p.images && p.images.length > 0) ? (
                          <img src={p.thumbnail || p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={16} className="text-gray-400" />
                        )}
                      </div>
                    </td>
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
                            : p.status === "DRAFT"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
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

export default function VendorProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>}>
      <VendorProductsContent />
    </Suspense>
  )
}