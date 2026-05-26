"use client"

import { useEffect, useState } from "react"
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  FileDown,
  Loader2,
  Eye,
  EyeOff,
  X,
} from "lucide-react"

interface Catalog {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  status: string
  coverImage: string | null
  pdfUrl: string | null
  createdAt: string
  vendor?: { id: string; firstName: string; lastName: string; companyName: string | null }
  items: { id: string; productId: string; sortOrder: number; customPrice: number | null; notes: string | null; product: { id: string; title: string; unitPrice: number } }[]
  _count?: { items: number }
}

interface Product {
  id: string
  title: string
  unitPrice: number
}

export default function AdminCatalogsPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Catalog | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  const [form, setForm] = useState({ name: "", description: "", isPublic: true })
  const [catalogItems, setCatalogItems] = useState<{ productId: string; sortOrder: number; customPrice: string; notes: string }[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) return
    Promise.all([
      fetch("/api/catalogs", { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
      fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
    ])
      .then(([catsData, prodsData]) => {
        setCatalogs(Array.isArray(catsData) ? catsData : catsData.catalogs ?? [])
        setProducts(prodsData.products ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = catalogs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const resetForm = () => {
    setForm({ name: "", description: "", isPublic: true })
    setCatalogItems([])
    setSelectedProduct("")
    setEditing(null)
    setShowForm(false)
  }

  const openEdit = (cat: Catalog) => {
    setEditing(cat)
    setForm({ name: cat.name, description: cat.description || "", isPublic: cat.isPublic })
    setCatalogItems(cat.items.map((it) => ({
      productId: it.productId,
      sortOrder: it.sortOrder,
      customPrice: it.customPrice !== null ? String(it.customPrice) : "",
      notes: it.notes || "",
    })))
    setShowForm(true)
  }

  const addItem = () => {
    if (!selectedProduct) return
    setCatalogItems([...catalogItems, { productId: selectedProduct, sortOrder: catalogItems.length, customPrice: "", notes: "" }])
    setSelectedProduct("")
  }

  const removeItem = (index: number) => {
    setCatalogItems(catalogItems.filter((_, i) => i !== index))
  }

  const saveCatalog = async () => {
    if (!form.name) return
    setSaving(true)
    const t = localStorage.getItem("token")!
    const body = {
      name: form.name,
      description: form.description || undefined,
      isPublic: form.isPublic,
      items: catalogItems.map((it) => ({
        productId: it.productId,
        sortOrder: it.sortOrder,
        customPrice: it.customPrice ? Number(it.customPrice) : undefined,
        notes: it.notes || undefined,
      })),
    }
    const url = editing ? `/api/catalogs/${editing.id}` : "/api/catalogs"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      resetForm()
      window.location.reload()
    } else {
      alert("Failed to save catalog")
    }
    setSaving(false)
  }

  const deleteCatalog = async (id: string) => {
    if (!confirm("Delete this catalog?")) return
    setDeleting(id)
    const t = localStorage.getItem("token")!
    const res = await fetch(`/api/catalogs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) {
      setCatalogs(catalogs.filter((c) => c.id !== id))
    } else {
      alert("Failed to delete catalog")
    }
    setDeleting(null)
  }

  const generatePdf = async (id: string) => {
    setGeneratingPdf(id)
    const t = localStorage.getItem("token")!
    const res = await fetch(`/api/catalogs/${id}/generate-pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.pdfUrl) {
        window.open(`/api/catalogs/${id}/download`, "_blank")
      }
    } else {
      alert("Failed to generate PDF")
    }
    setGeneratingPdf(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Catalogs</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
        >
          <Plus size={16} /> Create Catalog
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search catalogs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Catalog Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{editing ? "Edit Catalog" : "Create Catalog"}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Catalog name"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Public</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional description"
            />
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Products</label>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} — ₹{p.unitPrice}</option>
                ))}
              </select>
              <button onClick={addItem} disabled={!selectedProduct} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition disabled:opacity-50">
                <Plus size={16} />
              </button>
            </div>
            {catalogItems.length > 0 && (
              <div className="space-y-2">
                {catalogItems.map((item, i) => {
                  const prod = products.find((p) => p.id === item.productId)
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{prod?.title || item.productId}</p>
                      </div>
                      <input
                        type="number"
                        placeholder="Custom price"
                        value={item.customPrice}
                        onChange={(e) => {
                          const updated = [...catalogItems]
                          updated[i] = { ...updated[i], customPrice: e.target.value }
                          setCatalogItems(updated)
                        }}
                        className="w-28 px-2 py-1.5 border border-gray-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={item.notes}
                        onChange={(e) => {
                          const updated = [...catalogItems]
                          updated[i] = { ...updated[i], notes: e.target.value }
                          setCatalogItems(updated)
                        }}
                        className="w-28 px-2 py-1.5 border border-gray-200 rounded text-xs"
                      />
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={resetForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
            <button onClick={saveCatalog} disabled={saving || !form.name} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Catalog List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No catalogs found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat) => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 truncate">{cat.name}</h3>
                  {cat.isPublic ? (
                    <span title="Public"><Eye size={14} className="text-green-500" /></span>
                  ) : (
                    <span title="Private"><EyeOff size={14} className="text-gray-400" /></span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  cat.status === "PUBLISHED" ? "bg-green-100 text-green-700" :
                  cat.status === "DRAFT" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {cat.status}
                </span>
              </div>
              {cat.description && <p className="text-sm text-gray-500 line-clamp-2">{cat.description}</p>}
              <p className="text-xs text-gray-400">{cat._count?.items ?? cat.items?.length ?? 0} products</p>
              {cat.vendor && (
                <p className="text-xs text-gray-400">by {cat.vendor.companyName || `${cat.vendor.firstName} ${cat.vendor.lastName}`}</p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <button onClick={() => openEdit(cat)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50 transition">
                  <Edit2 size={12} /> Edit
                </button>
                <button onClick={() => generatePdf(cat.id)} disabled={generatingPdf === cat.id} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50 transition disabled:opacity-50">
                  {generatingPdf === cat.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                  {generatingPdf === cat.id ? "Generating..." : "PDF"}
                </button>
                <button onClick={() => deleteCatalog(cat.id)} disabled={deleting === cat.id} className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 transition disabled:opacity-50">
                  {deleting === cat.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}