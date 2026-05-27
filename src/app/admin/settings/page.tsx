"use client"

import { useEffect, useState, useRef } from "react"
import {
  Settings,
  Palette,
  Type,
  LayoutDashboard,
  Navigation,
  Upload,
  Save,
  Loader2,
  CheckCircle,
  X,
  ImageIcon,
} from "lucide-react"
import { generateShades } from "@/lib/settings/color-utils"

const GOOGLE_FONTS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
  "Playfair Display",
  "Merriweather",
  "Raleway",
  "Nunito",
  "Oswald",
  "Source Sans 3",
  "PT Sans",
  "Work Sans",
  "Rubik",
]

const TABS = [
  { key: "branding", label: "Branding", icon: LayoutDashboard },
  { key: "colors", label: "Colors", icon: Palette },
  { key: "typography", label: "Typography", icon: Type },
  { key: "homepage", label: "Homepage", icon: ImageIcon },
  { key: "header_footer", label: "Header & Footer", icon: Navigation },
] as const

type TabKey = (typeof TABS)[number]["key"]

interface SettingsState {
  siteName: string
  tagline: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  headingFont: string
  bodyFont: string
  headingFontSize: string
  bodyFontSize: string
  heroBannerUrl: string
  heroHeadline: string
  heroSubtext: string
  heroCtaText: string
  contactEmail: string
  contactPhone: string
  socialLinks: { facebook: string; twitter: string; instagram: string; linkedin: string }
  copyrightText: string
}

const DEFAULT_SETTINGS: SettingsState = {
  siteName: "WholesaleX Pro",
  tagline: "B2B Wholesale E-Commerce Platform",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#3b82f6",
  secondaryColor: "#64748b",
  accentColor: "#f59e0b",
  headingFont: "Inter",
  bodyFont: "Inter",
  headingFontSize: "36",
  bodyFontSize: "16",
  heroBannerUrl: "",
  heroHeadline: "Bulk Orders. Best Prices. Delivered.",
  heroSubtext: "Connect with top vendors, get tier pricing, request quotes, and manage your wholesale procurement — all in one platform.",
  heroCtaText: "Browse Products",
  contactEmail: "",
  contactPhone: "",
  socialLinks: { facebook: "", twitter: "", instagram: "", linkedin: "" },
  copyrightText: "WholesaleX Pro. All rights reserved.",
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("branding")
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const s = data.settings
          let socialLinks = DEFAULT_SETTINGS.socialLinks
          try {
            if (s.socialLinks) socialLinks = JSON.parse(s.socialLinks)
          } catch {}
          setSettings({
            siteName: s.siteName || DEFAULT_SETTINGS.siteName,
            tagline: s.tagline || DEFAULT_SETTINGS.tagline,
            logoUrl: s.logoUrl || "",
            faviconUrl: s.faviconUrl || "",
            primaryColor: s.primaryColor || DEFAULT_SETTINGS.primaryColor,
            secondaryColor: s.secondaryColor || DEFAULT_SETTINGS.secondaryColor,
            accentColor: s.accentColor || DEFAULT_SETTINGS.accentColor,
            headingFont: s.headingFont || DEFAULT_SETTINGS.headingFont,
            bodyFont: s.bodyFont || DEFAULT_SETTINGS.bodyFont,
            headingFontSize: s.headingFontSize || DEFAULT_SETTINGS.headingFontSize,
            bodyFontSize: s.bodyFontSize || DEFAULT_SETTINGS.bodyFontSize,
            heroBannerUrl: s.heroBannerUrl || "",
            heroHeadline: s.heroHeadline || DEFAULT_SETTINGS.heroHeadline,
            heroSubtext: s.heroSubtext || DEFAULT_SETTINGS.heroSubtext,
            heroCtaText: s.heroCtaText || DEFAULT_SETTINGS.heroCtaText,
            contactEmail: s.contactEmail || "",
            contactPhone: s.contactPhone || "",
            socialLinks,
            copyrightText: s.copyrightText || DEFAULT_SETTINGS.copyrightText,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleUpload = async (file: File, field: "logoUrl" | "faviconUrl" | "heroBannerUrl") => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/settings/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    if (data.url) {
      setSettings((prev) => ({ ...prev, [field]: data.url }))
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError("")
    setSuccess(false)
    try {
      const payload: Record<string, string> = {
        siteName: settings.siteName,
        tagline: settings.tagline,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        headingFont: settings.headingFont,
        bodyFont: settings.bodyFont,
        headingFontSize: settings.headingFontSize,
        bodyFontSize: settings.bodyFontSize,
        heroBannerUrl: settings.heroBannerUrl,
        heroHeadline: settings.heroHeadline,
        heroSubtext: settings.heroSubtext,
        heroCtaText: settings.heroCtaText,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        socialLinks: JSON.stringify(settings.socialLinks),
        copyrightText: settings.copyrightText,
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError("Failed to save settings. Please try again.")
      setTimeout(() => setError(""), 3000)
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Settings</h1>
          <p className="text-sm text-gray-500">Customize your store&apos;s appearance and content</p>
        </div>
        <div className="flex items-center gap-3">
          {success && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={16} /> Saved successfully
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-sm text-red-500">
              <X size={16} /> {error}
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
        {activeTab === "branding" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => update("siteName", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => update("tagline", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
              <div className="flex items-center gap-4">
                {settings.logoUrl ? (
                  <div className="relative">
                    <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain border border-gray-200 rounded-lg p-1" />
                    <button
                      onClick={() => update("logoUrl", "")}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">
                    <ImageIcon size={24} />
                  </div>
                )}
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logoUrl")}
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <Upload size={14} /> Upload Logo
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Favicon</label>
              <div className="flex items-center gap-4">
                {settings.faviconUrl ? (
                  <div className="relative">
                    <img src={settings.faviconUrl} alt="Favicon" className="h-8 w-8 object-contain border border-gray-200 rounded" />
                    <button
                      onClick={() => update("faviconUrl", "")}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="h-8 w-8 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
                    <ImageIcon size={14} />
                  </div>
                )}
                <div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "faviconUrl")}
                  />
                  <button
                    onClick={() => faviconInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <Upload size={14} /> Upload Favicon
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "colors" && (
          <div className="space-y-8">
            {([
              { key: "primaryColor" as const, label: "Primary Color", desc: "Main brand color used for buttons, links, highlights" },
              { key: "secondaryColor" as const, label: "Secondary Color", desc: "Supporting color for text, borders, subtle elements" },
              { key: "accentColor" as const, label: "Accent Color", desc: "Attention color for badges, warnings, special highlights" },
            ]).map(({ key, label, desc }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{label}</label>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-mono text-center"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {Object.entries(generateShades(settings[key])).map(([shade, hex]) => (
                    <div key={shade} className="text-center">
                      <div className="w-10 h-10 rounded-lg border border-gray-200" style={{ backgroundColor: hex }} />
                      <span className="text-[10px] text-gray-400">{shade}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "typography" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heading Font</label>
              <select
                value={settings.headingFont}
                onChange={(e) => update("headingFont", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <p className="mt-2 text-lg font-bold" style={{ fontFamily: `'${settings.headingFont}', sans-serif` }}>
                Preview: {settings.siteName}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body Font</label>
              <select
                value={settings.bodyFont}
                onChange={(e) => update("bodyFont", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <p className="mt-2 text-sm" style={{ fontFamily: `'${settings.bodyFont}', sans-serif` }}>
                Preview: The quick brown fox jumps over the lazy dog.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heading Font Size (px)</label>
                <input
                  type="number"
                  value={settings.headingFontSize}
                  onChange={(e) => update("headingFontSize", e.target.value)}
                  min="20"
                  max="72"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Font Size (px)</label>
                <input
                  type="number"
                  value={settings.bodyFontSize}
                  onChange={(e) => update("bodyFontSize", e.target.value)}
                  min="12"
                  max="24"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "homepage" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hero Banner Image</label>
              <div className="flex items-center gap-4">
                {settings.heroBannerUrl ? (
                  <div className="relative">
                    <img src={settings.heroBannerUrl} alt="Hero Banner" className="h-24 w-40 object-cover border border-gray-200 rounded-lg" />
                    <button
                      onClick={() => update("heroBannerUrl", "")}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                    Default gradient
                  </div>
                )}
                <div>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "heroBannerUrl")}
                  />
                  <button
                    onClick={() => bannerInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <Upload size={14} /> Upload Banner
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hero Headline</label>
              <input
                type="text"
                value={settings.heroHeadline}
                onChange={(e) => update("heroHeadline", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hero Subtext</label>
              <textarea
                value={settings.heroSubtext}
                onChange={(e) => update("heroSubtext", e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hero CTA Button Text</label>
              <input
                type="text"
                value={settings.heroCtaText}
                onChange={(e) => update("heroCtaText", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}

        {activeTab === "header_footer" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="support@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={settings.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="+91 12345 67890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Social Links</label>
              <div className="space-y-3">
                {(["facebook", "twitter", "instagram", "linkedin"] as const).map((platform) => (
                  <div key={platform} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-gray-500 capitalize">{platform}</span>
                    <input
                      type="url"
                      value={settings.socialLinks[platform]}
                      onChange={(e) =>
                        update("socialLinks", { ...settings.socialLinks, [platform]: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={`https://${platform}.com/yourpage`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Copyright Text</label>
              <input
                type="text"
                value={settings.copyrightText}
                onChange={(e) => update("copyrightText", e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}