"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Plus, Trash2, Edit2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, X,
  Image as ImageIcon, Search, GripVertical, ChevronDown, Eye, EyeOff,
} from "lucide-react"

/* ── Types ── */

interface Category { id: string; name: string; handle: string; image: string | null }

interface HomeSection {
  id: string
  type: string
  title: string | null
  subtitle: string | null
  config: any
  rank: number
  isActive: boolean
  categoryId: string | null
  category?: Category | null
  createdAt: string
  updatedAt: string
}

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
}

interface Product {
  id: string
  title: string
  handle: string
  unitPrice: string
  thumbnail: string | null
  images: string[]
  category: { id: string; name: string; handle: string } | null
}

const SECTION_TYPES = [
  { value: "announcement", label: "Announcement Bar" },
  { value: "category_icons", label: "Category Icons" },
  { value: "top_selling", label: "Top Selling Products" },
  { value: "trust_badges", label: "Trust Badges" },
  { value: "shop_by_category", label: "Shop by Category" },
  { value: "promotional", label: "Promotional Banner" },
  { value: "cta", label: "CTA Banner" },
]

const DEFAULT_CONFIGS: Record<string, any> = {
  announcement: { text: "", color: "#ffffff", bgColor: "#ef4444" },
  category_icons: { columns: 6 },
  top_selling: { limit: 8, productIds: [] },
  trust_badges: { items: [
    { icon: "Truck", title: "Free Delivery", desc: "On orders above ₹50,000" },
    { icon: "ShieldCheck", title: "Genuine Products", desc: "100% authentic products" },
    { icon: "IndianRupee", title: "Best Prices", desc: "Wholesale pricing guaranteed" },
    { icon: "Tag", title: "Bulk Pricing", desc: "Automatic volume discounts" },
  ] },
  shop_by_category: { columns: 4 },
  promotional: { imageUrl: "", linkUrl: "" },
  cta: { headline: "Ready to buy in bulk?", subtext: "Sign up for free and get access to exclusive wholesale pricing today.", ctaText: "Get Started Free", ctaLink: "/register", ctaText2: "Request a Quote", ctaLink2: "/rfqs/new" },
}

/* ── Product Picker Modal ── */

function ProductPickerModal({
  open,
  onClose,
  selectedIds,
  onSave,
  categoryId,
  categories,
}: {
  open: boolean
  onClose: () => void
  selectedIds: string[]
  onSave: (ids: string[]) => void
  categoryId: string
  categories: Category[]
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds)

  useEffect(() => {
    setLocalSelected(selectedIds)
  }, [selectedIds, open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const params = new URLSearchParams()
    if (categoryId) params.set("category", categoryId)
    if (search) params.set("q", search)
    params.set("limit", "50")
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [open, categoryId, search])

  const toggleProduct = (id: string) => {
    setLocalSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  if (!open) return null

  const catName = categories.find((c) => c.id === categoryId)?.name || "All Products"

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Select Products — {catName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <div className="text-center py-8 text-gray-500">Loading...</div>}
          {!loading && products.length === 0 && <div className="text-center py-8 text-gray-500">No products found</div>}
          {products.map((p) => {
            const isSelected = localSelected.includes(p.id)
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${isSelected ? "border-primary-500 bg-primary-50" : "border-gray-100 hover:bg-gray-50"}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleProduct(p.id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                  {p.thumbnail || p.images?.[0] ? (
                    <img src={p.thumbnail || p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-xs text-gray-500">{p.category?.name} · ₹{Number(p.unitPrice).toLocaleString("en-IN")}</p>
                </div>
              </label>
            )
          })}
        </div>
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-xl">
          <span className="text-sm text-gray-600">{localSelected.length} product{localSelected.length !== 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
            <button onClick={() => { onSave(localSelected); onClose() }} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">Apply Selection</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Banner Form Sub-component ── */

function BannerForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
  uploading,
  handleUpload,
}: any) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input type="text" value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
        <input type="text" value={form.subtitle} onChange={(e: any) => setForm({ ...form, subtitle: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image *</label>
        {form.imageUrl && <img src={form.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2" />}
        <input type="file" accept="image/*" onChange={(e: any) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="w-full text-sm" disabled={uploading} />
        {uploading && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
        <input type="text" value={form.imageUrl} onChange={(e: any) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Or enter image URL" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mt-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
        <input type="text" value={form.linkUrl} onChange={(e: any) => setForm({ ...form, linkUrl: e.target.value })} placeholder="/products" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
        <input type="text" value={form.buttonText} onChange={(e: any) => setForm({ ...form, buttonText: e.target.value })} placeholder="Shop Now" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input type="date" value={form.startDate} onChange={(e: any) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
        <input type="date" value={form.endDate} onChange={(e: any) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.isActive} onChange={(e: any) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300" />
        <label className="text-sm font-medium text-gray-700">Active</label>
      </div>
      <div className="md:col-span-2 flex gap-3">
        <button type="submit" disabled={saving || !form.imageUrl} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : form.editingId ? "Update" : "Create Banner"}</button>
        <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </form>
  )
}

/* ── Main Page ── */

export default function AdminHomeSectionsPage() {
  const [sections, setSections] = useState<HomeSection[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"banners" | "top_selling" | "other">("banners")

  // Section form state
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null)
  const [sectionSaving, setSectionSaving] = useState(false)
  const [sectionForm, setSectionForm] = useState({ type: "top_selling", title: "", subtitle: "", isActive: true, categoryId: "", config: {} as any })

  // Banner form state
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [bannerForm, setBannerForm] = useState({ editingId: "", title: "", subtitle: "", imageUrl: "", linkUrl: "", buttonText: "", rank: 0, isActive: true, section: "hero", startDate: "", endDate: "" })

  // Product picker state
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadAll() }, [token])

  const loadAll = async () => {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [secRes, banRes, catRes] = await Promise.all([
        fetch("/api/home-sections/all", { headers }),
        fetch("/api/banners/all", { headers }),
        fetch("/api/categories"),
      ])
      const secData = await secRes.json()
      const banData = await banRes.json()
      const catData = await catRes.json()
      setSections(Array.isArray(secData) ? secData : secData.sections ?? [])
      setBanners(Array.isArray(banData) ? banData : banData.banners ?? [])
      const flat: Category[] = []
      const walk = (arr: any[]) => { for (const c of arr || []) { flat.push({ id: c.id, name: c.name, handle: c.handle, image: c.image }); walk(c.children) } }
      walk(catData.categories || [])
      setCategories(flat)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  // ── Section CRUD ──

  const resetSectionForm = () => {
    setSectionForm({ type: "top_selling", title: "", subtitle: "", isActive: true, categoryId: "", config: {} })
    setEditingSection(null)
    setShowSectionForm(false)
  }

  const openEditSection = (s: HomeSection) => {
    setEditingSection(s)
    const parsedConfig = typeof s.config === "string" ? JSON.parse(s.config) : (s.config || {})
    setSectionForm({ type: s.type, title: s.title || "", subtitle: s.subtitle || "", isActive: s.isActive, categoryId: s.categoryId || "", config: parsedConfig })
    setSelectedProductIds(parsedConfig.productIds || [])
    setShowSectionForm(true)
  }

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSectionSaving(true)
    const config = { ...sectionForm.config }
    if (sectionForm.type === "top_selling") {
      config.productIds = selectedProductIds
    }
    const body: any = { type: sectionForm.type, title: sectionForm.title || undefined, subtitle: sectionForm.subtitle || undefined, isActive: sectionForm.isActive, categoryId: sectionForm.categoryId || undefined, config }
    try {
      const res = await fetch(editingSection ? `/api/home-sections/${editingSection.id}` : "/api/home-sections", {
        method: editingSection ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { resetSectionForm(); loadAll() }
      else { const d = await res.json(); alert(d.message || "Failed to save") }
    } catch { alert("Failed to save") } finally { setSectionSaving(false) }
  }

  const handleSectionDelete = async (id: string) => {
    if (!confirm("Delete this section?")) return
    await fetch(`/api/home-sections/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    loadAll()
  }

  const toggleSectionActive = async (s: HomeSection) => {
    await fetch(`/api/home-sections/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive: !s.isActive }) })
    loadAll()
  }

  const moveSection = async (sections: HomeSection[], index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === sections.length - 1) return
    const newSections = [...sections]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    const temp = newSections[index]
    newSections[index] = newSections[swapIndex]
    newSections[swapIndex] = temp
    await fetch("/api/home-sections/reorder", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: newSections.map((s) => s.id) }) })
    loadAll()
  }

  // ── Banner CRUD ──

  const resetBannerForm = () => {
    setBannerForm({ editingId: "", title: "", subtitle: "", imageUrl: "", linkUrl: "", buttonText: "", rank: 0, isActive: true, section: "hero", startDate: "", endDate: "" })
    setShowBannerForm(false)
  }

  const openEditBanner = (b: Banner) => {
    setBannerForm({
      editingId: b.id, title: b.title, subtitle: b.subtitle || "", imageUrl: b.imageUrl,
      linkUrl: b.linkUrl || "", buttonText: b.buttonText || "", rank: b.rank,
      isActive: b.isActive, section: b.section,
      startDate: b.startDate ? b.startDate.slice(0, 10) : "", endDate: b.endDate ? b.endDate.slice(0, 10) : "",
    })
    setShowBannerForm(true)
  }

  const handleBannerUpload = async (file: File) => {
    setBannerUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/banners/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData })
      const data = await res.json()
      if (data.url) setBannerForm((f) => ({ ...f, imageUrl: data.url }))
      else alert("Upload failed")
    } catch { alert("Upload failed") } finally { setBannerUploading(false) }
  }

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBannerSaving(true)
    const body: any = {
      title: bannerForm.title, subtitle: bannerForm.subtitle || undefined, imageUrl: bannerForm.imageUrl,
      linkUrl: bannerForm.linkUrl || undefined, buttonText: bannerForm.buttonText || undefined,
      rank: bannerForm.rank, isActive: bannerForm.isActive, section: bannerForm.section,
      startDate: bannerForm.startDate ? new Date(bannerForm.startDate).toISOString() : undefined,
      endDate: bannerForm.endDate ? new Date(bannerForm.endDate).toISOString() : undefined,
    }
    try {
      const res = await fetch(bannerForm.editingId ? `/api/banners/${bannerForm.editingId}` : "/api/banners", {
        method: bannerForm.editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { resetBannerForm(); loadAll() }
      else { const d = await res.json(); alert(d.message || "Failed to save") }
    } catch { alert("Failed to save") } finally { setBannerSaving(false) }
  }

  const handleBannerDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return
    await fetch(`/api/banners/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    loadAll()
  }

  const toggleBannerActive = async (b: Banner) => {
    await fetch(`/api/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive: !b.isActive }) })
    loadAll()
  }

  const moveBanner = async (index: number, direction: "up" | "down") => {
    const heroBanners = banners.filter((b) => b.section === "hero")
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === heroBanners.length - 1) return
    const newBanners = [...heroBanners]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    const temp = newBanners[index]
    newBanners[index] = newBanners[swapIndex]
    newBanners[swapIndex] = temp
    await fetch("/api/banners/reorder", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: newBanners.map((b) => b.id) }) })
    loadAll()
  }

  // ── Badge item helpers ──

  const updateBadgeItem = (index: number, field: string, value: string) => {
    const items = [...(sectionForm.config.items || [])]
    items[index] = { ...items[index], [field]: value }
    setSectionForm({ ...sectionForm, config: { ...sectionForm.config, items } })
  }
  const addBadgeItem = () => {
    const items = [...(sectionForm.config.items || []), { icon: "Truck", title: "", desc: "" }]
    setSectionForm({ ...sectionForm, config: { ...sectionForm.config, items } })
  }
  const removeBadgeItem = (index: number) => {
    const items = (sectionForm.config.items || []).filter((_: any, i: number) => i !== index)
    setSectionForm({ ...sectionForm, config: { ...sectionForm.config, items } })
  }

  // ── Computed lists ──

  const heroBanners = banners.filter((b) => b.section === "hero")
  const topSellingSections = sections.filter((s) => s.type === "top_selling")
  const otherSections = sections.filter((s) => s.type !== "top_selling" && s.type !== "hero_carousel")

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  const tabs = [
    { key: "banners" as const, label: "Hero Banners", icon: <ImageIcon size={16} />, count: heroBanners.length },
    { key: "top_selling" as const, label: "Top Selling", icon: <GripVertical size={16} />, count: topSellingSections.length },
    { key: "other" as const, label: "Other Sections", icon: <ChevronDown size={16} />, count: otherSections.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Homepage Settings</h1>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? "bg-white shadow text-primary-700" : "text-gray-600 hover:text-gray-900"}`}
          >
            {tab.icon}
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? "bg-primary-100 text-primary-700" : "bg-gray-200 text-gray-600"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ── Tab 1: Hero Banners ── */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "banners" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Manage hero carousel slides that appear at the top of your homepage.</p>
            <button onClick={() => { resetBannerForm(); setShowBannerForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition">
              <Plus size={16} /> Add Banner
            </button>
          </div>

          {showBannerForm && (
            <div className="bg-white rounded-lg border border-primary-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{bannerForm.editingId ? "Edit Banner" : "Create Banner"}</h2>
                <button onClick={resetBannerForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <BannerForm form={bannerForm} setForm={setBannerForm} saving={bannerSaving} onSubmit={handleBannerSubmit} onCancel={resetBannerForm} uploading={bannerUploading} handleUpload={handleBannerUpload} />
            </div>
          )}

          {heroBanners.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No hero banners yet. Add banners for your homepage carousel.
            </div>
          ) : (
            <div className="space-y-3">
              {heroBanners.map((banner, index) => (
                <div key={banner.id} className={`bg-white rounded-lg border ${banner.isActive ? "border-gray-200" : "border-gray-100 opacity-60"} p-4`}>
                  <div className="flex items-center gap-4">
                    {banner.imageUrl && <img src={banner.imageUrl} alt={banner.title} className="w-24 h-14 object-cover rounded-lg flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{banner.title}</div>
                      {banner.subtitle && <div className="text-sm text-gray-500 truncate">{banner.subtitle}</div>}
                      {banner.buttonText && <span className="inline-block mt-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">{banner.buttonText}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveBanner(index, "up")} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => moveBanner(index, "down")} disabled={index === heroBanners.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                    <button onClick={() => toggleBannerActive(banner)} className="text-sm">
                      {banner.isActive ? <ToggleRight size={24} className="text-green-600" /> : <ToggleLeft size={24} className="text-gray-400" />}
                    </button>
                    <button onClick={() => openEditBanner(banner)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 size={14} className="text-gray-500" /></button>
                    <button onClick={() => handleBannerDelete(banner.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── Tab 2: Top Selling Sections ── */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "top_selling" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Configure which categories appear as "Top Selling" sections on the homepage. You can manually pick products or auto-sort by popularity.</p>
            <button
              onClick={() => {
                setSectionForm({ type: "top_selling", title: "", subtitle: "", isActive: true, categoryId: "", config: { limit: 8, productIds: [] } })
                setSelectedProductIds([])
                setEditingSection(null)
                setShowSectionForm(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
            >
              <Plus size={16} /> Add Top Selling Section
            </button>
          </div>

          {showSectionForm && sectionForm.type === "top_selling" && (
            <div className="bg-white rounded-lg border border-primary-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{editingSection ? "Edit Top Selling Section" : "Add Top Selling Section"}</h2>
                <button onClick={resetSectionForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <form onSubmit={handleSectionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section Title</label>
                    <input type="text" value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="e.g. Top Selling ACs" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select value={sectionForm.categoryId} onChange={(e) => setSectionForm({ ...sectionForm, categoryId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">Select category...</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Products to show</label>
                  <input type="number" value={sectionForm.config.limit || 8} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, limit: Number(e.target.value) } })} min={1} max={20} className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>

                {/* ── Product Picker ── */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Featured Products</label>
                    <button
                      type="button"
                      onClick={() => setProductPickerOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700"
                    >
                      <Plus size={14} /> Select Products
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Leave empty to auto-sort by popularity. Select specific products to curate the section.</p>
                  {selectedProductIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">{selectedProductIds.length} product{selectedProductIds.length !== 1 ? "s" : ""} selected</span>
                      <button type="button" onClick={() => setSelectedProductIds([])} className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded-full hover:bg-red-100">Clear all</button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No products selected — will auto-sort by popularity</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sectionForm.isActive} onChange={(e) => setSectionForm({ ...sectionForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                  <label className="text-sm font-medium text-gray-700">Active</label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={sectionSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{sectionSaving ? "Saving..." : editingSection ? "Update" : "Create"}</button>
                  <button type="button" onClick={resetSectionForm} className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <ProductPickerModal
            open={productPickerOpen}
            onClose={() => setProductPickerOpen(false)}
            selectedIds={selectedProductIds}
            onSave={(ids) => setSelectedProductIds(ids)}
            categoryId={sectionForm.categoryId}
            categories={categories}
          />

          {topSellingSections.length === 0 && !showSectionForm ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No top selling sections yet. Add one to showcase products from a category.
            </div>
          ) : (
            <div className="space-y-3">
              {topSellingSections.map((section, index) => {
                const config = typeof section.config === "string" ? JSON.parse(section.config) : (section.config || {})
                const productCount = config.productIds?.length || 0
                return (
                  <div key={section.id} className={`bg-white rounded-lg border ${section.isActive ? "border-gray-200" : "border-gray-100 opacity-60"} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => moveSection(topSellingSections, index, "up")} disabled={index === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                          <button onClick={() => moveSection(topSellingSections, index, "down")} disabled={index === topSellingSections.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{section.title || "Untitled Section"}</span>
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">Top Selling</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {section.category && <span className="text-xs text-gray-500">Category: {section.category.name}</span>}
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-500">Limit: {config.limit || 8}</span>
                            {productCount > 0 && (
                              <>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-primary-600 font-medium">{productCount} curated product{productCount !== 1 ? "s" : ""}</span>
                              </>
                            )}
                            {productCount === 0 && (
                              <>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-400">Auto-sort by popularity</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleSectionActive(section)} className="text-sm">
                          {section.isActive ? <ToggleRight size={24} className="text-green-600" /> : <ToggleLeft size={24} className="text-gray-400" />}
                        </button>
                        <button onClick={() => openEditSection(section)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 size={14} className="text-gray-500" /></button>
                        <button onClick={() => handleSectionDelete(section.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── Tab 3: Other Sections ── */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "other" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Manage announcement bars, category icons, trust badges, promotional banners, and CTA sections.</p>
            <button
              onClick={() => {
                setSectionForm({ type: "announcement", title: "", subtitle: "", isActive: true, categoryId: "", config: JSON.parse(JSON.stringify(DEFAULT_CONFIGS.announcement)) })
                setEditingSection(null)
                setShowSectionForm(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
            >
              <Plus size={16} /> Add Section
            </button>
          </div>

          {showSectionForm && sectionForm.type !== "top_selling" && (
            <div className="bg-white rounded-lg border border-primary-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{editingSection ? "Edit Section" : "Add Section"}</h2>
                <button onClick={resetSectionForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <form onSubmit={handleSectionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section Type *</label>
                    <select value={sectionForm.type} onChange={(e) => setSectionForm({ ...sectionForm, type: e.target.value, config: DEFAULT_CONFIGS[e.target.value] ? JSON.parse(JSON.stringify(DEFAULT_CONFIGS[e.target.value])) : {} })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" disabled={!!editingSection}>
                      {SECTION_TYPES.filter((t) => t.value !== "top_selling").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input type="text" value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Section title" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>

                {sectionForm.type === "announcement" && (
                  <div className="space-y-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Announcement Text</label><input type="text" value={sectionForm.config.text || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, text: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label><input type="color" value={sectionForm.config.color || "#ffffff"} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, color: e.target.value } })} className="w-full h-10 border border-gray-200 rounded-lg" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label><input type="color" value={sectionForm.config.bgColor || "#ef4444"} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, bgColor: e.target.value } })} className="w-full h-10 border border-gray-200 rounded-lg" /></div>
                    </div>
                  </div>
                )}

                {sectionForm.type === "category_icons" && (
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Columns</label><input type="number" value={sectionForm.config.columns || 6} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, columns: Number(e.target.value) } })} min={2} max={8} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                )}

                {sectionForm.type === "trust_badges" && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Badge Items</label>
                    {(sectionForm.config.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <input type="text" value={item.icon} onChange={(e) => updateBadgeItem(i, "icon", e.target.value)} placeholder="Icon name (e.g. Truck)" className="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
                          <input type="text" value={item.title} onChange={(e) => updateBadgeItem(i, "title", e.target.value)} placeholder="Title" className="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
                          <input type="text" value={item.desc} onChange={(e) => updateBadgeItem(i, "desc", e.target.value)} placeholder="Description" className="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
                        </div>
                        <button type="button" onClick={() => removeBadgeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={addBadgeItem} className="px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">+ Add Badge</button>
                  </div>
                )}

                {sectionForm.type === "shop_by_category" && (
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Grid Columns</label><input type="number" value={sectionForm.config.columns || 4} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, columns: Number(e.target.value) } })} min={2} max={6} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                )}

                {sectionForm.type === "promotional" && (
                  <div className="space-y-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label><input type="text" value={sectionForm.config.imageUrl || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, imageUrl: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label><input type="text" value={sectionForm.config.linkUrl || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, linkUrl: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  </div>
                )}

                {sectionForm.type === "cta" && (
                  <div className="space-y-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Headline</label><input type="text" value={sectionForm.config.headline || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, headline: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Subtext</label><textarea value={sectionForm.config.subtext || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, subtext: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={2} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Button 1 Text</label><input type="text" value={sectionForm.config.ctaText || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, ctaText: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Button 1 Link</label><input type="text" value={sectionForm.config.ctaLink || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, ctaLink: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Button 2 Text</label><input type="text" value={sectionForm.config.ctaText2 || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, ctaText2: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Button 2 Link</label><input type="text" value={sectionForm.config.ctaLink2 || ""} onChange={(e) => setSectionForm({ ...sectionForm, config: { ...sectionForm.config, ctaLink2: e.target.value } })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sectionForm.isActive} onChange={(e) => setSectionForm({ ...sectionForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                  <label className="text-sm font-medium text-gray-700">Active</label>
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={sectionSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{sectionSaving ? "Saving..." : editingSection ? "Update" : "Create"}</button>
                  <button type="button" onClick={resetSectionForm} className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {otherSections.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No sections configured yet. Add announcement bars, trust badges, category sections, and more.
            </div>
          ) : (
            <div className="space-y-3">
              {otherSections.map((section, index) => (
                <div key={section.id} className={`bg-white rounded-lg border ${section.isActive ? "border-gray-200" : "border-gray-100 opacity-60"} p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveSection(otherSections, index, "up")} disabled={index === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button onClick={() => moveSection(otherSections, index, "down")} disabled={index === otherSections.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{SECTION_TYPES.find((t) => t.value === section.type)?.label || section.type}</span>
                          <span className="font-medium text-gray-900">{section.title || "Untitled"}</span>
                        </div>
                        {section.category && <p className="text-xs text-gray-500 mt-0.5">Category: {section.category.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSectionActive(section)} className="text-sm">
                        {section.isActive ? <ToggleRight size={24} className="text-green-600" /> : <ToggleLeft size={24} className="text-gray-400" />}
                      </button>
                      <button onClick={() => openEditSection(section)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 size={14} className="text-gray-500" /></button>
                      <button onClick={() => handleSectionDelete(section.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-500" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}