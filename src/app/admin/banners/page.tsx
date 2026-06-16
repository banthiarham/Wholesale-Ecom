"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2, Image as ImageIcon, ArrowUp, ArrowDown, ToggleLeft, ToggleRight } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface Banner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  linkUrl: string | null
  buttonText: string | null
  rank: number
  isActive: boolean
  section: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

const SECTIONS = [
  { value: "hero", label: "Hero Carousel" },
  { value: "mid", label: "Mid-Page Banner" },
  { value: "cta", label: "CTA Banner" },
]

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterSection, setFilterSection] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    buttonText: "",
    rank: 0,
    isActive: true,
    section: "hero",
    startDate: "",
    endDate: "",
  })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadBanners() }, [token])

  const loadBanners = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/banners/all" + (filterSection ? `?section=${filterSection}` : ""), { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setBanners(Array.isArray(data) ? data : data.banners ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { loadBanners() }, [filterSection])

  const filtered = banners.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))

  const resetForm = () => {
    setForm({ title: "", subtitle: "", imageUrl: "", linkUrl: "", buttonText: "", rank: 0, isActive: true, section: "hero", startDate: "", endDate: "" })
    setEditing(null)
    setShowForm(false)
  }

  const openEdit = (b: Banner) => {
    setEditing(b)
    setForm({
      title: b.title,
      subtitle: b.subtitle || "",
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl || "",
      buttonText: b.buttonText || "",
      rank: b.rank,
      isActive: b.isActive,
      section: b.section,
      startDate: b.startDate ? b.startDate.slice(0, 10) : "",
      endDate: b.endDate ? b.endDate.slice(0, 10) : "",
    })
    setShowForm(true)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/banners/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.url) setForm((f) => ({ ...f, imageUrl: data.url }))
      else alert("Upload failed")
    } catch (e) { console.error(e); alert("Upload failed") } finally { setUploading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body: any = {
      title: form.title,
      subtitle: form.subtitle || undefined,
      imageUrl: form.imageUrl,
      linkUrl: form.linkUrl || undefined,
      buttonText: form.buttonText || undefined,
      rank: form.rank,
      isActive: form.isActive,
      section: form.section,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
    }
    try {
      const res = await fetch(editing ? `/api/banners/${editing.id}` : "/api/banners", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { resetForm(); loadBanners() }
      else { const d = await res.json(); alert(d.message || "Failed to save") }
    } catch (e) { console.error(e); alert("Failed to save") } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return
    await fetch(`/api/banners/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    setBanners((prev) => prev.filter((b) => b.id !== id))
  }

  const toggleActive = async (b: Banner) => {
    await fetch(`/api/banners/${b.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !b.isActive }),
    })
    loadBanners()
  }

  const moveUp = async (index: number) => {
    if (index === 0) return
    const newBanners = [...filtered]
    const temp = newBanners[index]
    newBanners[index] = newBanners[index - 1]
    newBanners[index - 1] = temp
    await fetch("/api/banners/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: newBanners.map((b) => b.id) }),
    })
    loadBanners()
  }

  const moveDown = async (index: number) => {
    if (index === filtered.length - 1) return
    const newBanners = [...filtered]
    const temp = newBanners[index]
    newBanners[index] = newBanners[index + 1]
    newBanners[index + 1] = temp
    await fetch("/api/banners/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: newBanners.map((b) => b.id) }),
    })
    loadBanners()
  }

  if (loading) return <SkeletonTable rows={5} cols={6} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Banners</h1>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition">
          <Plus size={16} /> Create Banner
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input type="text" placeholder="Search banners..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
          <option value="">All Sections</option>
          {SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold dark:text-gray-100">{editing ? "Edit Banner" : "Create Banner"}</h2>
            <button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtitle</label>
              <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banner Image *</label>
              {form.imageUrl && <img src={form.imageUrl} alt="Banner preview" className="w-full h-40 object-cover rounded-lg mb-2" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="w-full text-sm" disabled={uploading} />
              {uploading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploading...</p>}
              {!form.imageUrl && !uploading && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Or enter URL directly:</p>}
              <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm mt-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link URL</label>
              <input type="text" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="/products" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Button Text</label>
              <input type="text" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} placeholder="Shop Now" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm">
                {SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank (order)</label>
              <input type="number" value={form.rank} onChange={(e) => setForm({ ...form, rank: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300 dark:border-gray-700" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving || !form.imageUrl} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:text-gray-100">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Image</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Section</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Order</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((banner, index) => (
              <tr key={banner.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3"><img src={banner.imageUrl} alt={banner.title} className="w-20 h-12 object-cover rounded" /></td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{banner.title}</div>
                  {banner.subtitle && <div className="text-xs text-gray-500 dark:text-gray-400">{banner.subtitle}</div>}
                </td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-full">{SECTIONS.find((s) => s.value === banner.section)?.label || banner.section}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(banner)} className="text-sm">
                    {banner.isActive ? <ToggleRight size={24} className="text-green-600" /> : <ToggleLeft size={24} className="text-gray-400 dark:text-gray-500" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => moveUp(index)} disabled={index === 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => moveDown(index)} disabled={index === filtered.length - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(banner)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Edit2 size={14} className="text-gray-500 dark:text-gray-400" /></button>
                    <button onClick={() => handleDelete(banner.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No banners found. Create your first banner!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}