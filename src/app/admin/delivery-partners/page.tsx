"use client"

import { useEffect, useState } from "react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import {
  Truck,
  Plus,
  Edit3,
  Trash2,
  X,
  Loader2,
  ExternalLink,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Plug,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface DeliveryPartner {
  id: string
  name: string
  code: string
  trackingUrlTemplate: string | null
  contactEmail: string | null
  contactPhone: string | null
  logo: string | null
  isActive: boolean
  apiEnabled: boolean
  credentials: Record<string, string> | null
  credentialFields: { key: string; label: string; required: boolean }[] | null
  apiBaseUrl: string | null
  testMode: boolean
  webhookUrl: string | null
  settings: Record<string, any> | null
  _count?: { orders: number }
}

const BUILTIN_PROVIDERS = ["DELHIVERY", "BLUEDART", "ECOM_EXPRESS", "DTDC"] as const

const PROVIDER_LABELS: Record<string, string> = {
  DELHIVERY: "Delhivery",
  BLUEDART: "BlueDart",
  ECOM_EXPRESS: "Ecom Express",
  DTDC: "DTDC",
}

const PROVIDER_CREDENTIAL_FIELDS: Record<string, { key: string; label: string; required: boolean }[]> = {
  DELHIVERY: [{ key: "apiKey", label: "API Key / Token", required: true }],
  BLUEDART: [
    { key: "licenseKey", label: "License Key", required: true },
    { key: "apiKey", label: "API Key", required: true },
  ],
  ECOM_EXPRESS: [{ key: "apiKey", label: "API Key", required: true }],
  DTDC: [
    { key: "apiKey", label: "API Key", required: true },
    { key: "customerId", label: "Customer ID", required: true },
  ],
}

export default function AdminDeliveryPartnersPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DeliveryPartner | null>(null)
  const [form, setForm] = useState({
    name: "",
    code: "",
    trackingUrlTemplate: "",
    contactEmail: "",
    contactPhone: "",
    isActive: true,
    apiEnabled: false,
    testMode: false,
    apiBaseUrl: "",
    webhookUrl: "",
    credentialFields: {} as Record<string, string>,
    selectedProvider: "",
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState("")
  const [apiSectionOpen, setApiSectionOpen] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""

  useEffect(() => {
    fetch("/api/delivery-partners/all", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPartners(data))
      .catch((err) => { console.error("Failed to fetch delivery partners:", err) })
      .finally(() => setLoading(false))
  }, [])

  const savePartner = async () => {
    setSaving(true)
    try {
      const url = editing ? `/api/delivery-partners/${editing.id}` : "/api/delivery-partners"
      const method = editing ? "PUT" : "POST"

      // Only include non-empty credential fields
      const filteredCredentials: Record<string, string> = {}
      for (const [k, v] of Object.entries(form.credentialFields)) {
        if (v.trim()) filteredCredentials[k] = v
      }

      const body: Record<string, any> = {
        name: form.name,
        code: form.code,
        trackingUrlTemplate: form.trackingUrlTemplate || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        isActive: form.isActive,
        apiEnabled: form.apiEnabled,
        testMode: form.testMode,
        apiBaseUrl: form.apiBaseUrl || null,
        webhookUrl: form.webhookUrl || null,
        credentials: form.apiEnabled && Object.keys(filteredCredentials).length > 0 ? filteredCredentials : null,
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed")
      const saved = await res.json()
      if (editing) {
        setPartners((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
      } else {
        setPartners((prev) => [...prev, saved])
      }
      setShowForm(false)
      setEditing(null)
      setSuccess(editing ? "Partner updated" : "Partner created")
      setTimeout(() => setSuccess(""), 3000)
    } catch {
      alert("Failed to save partner")
    } finally {
      setSaving(false)
    }
  }

  const deletePartner = async (id: string) => {
    if (!confirm("Deactivate this partner?")) return
    const res = await fetch(`/api/delivery-partners/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const updated = await res.json()
    if (updated.isActive === false) {
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)))
    } else {
      setPartners((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const toggleActive = async (partner: DeliveryPartner) => {
    const res = await fetch(`/api/delivery-partners/${partner.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !partner.isActive }),
    })
    const updated = await res.json()
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? updated : p)))
  }

  const testConnection = async () => {
    if (!editing) return
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/delivery-partners/${editing.id}/test-connection`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, message: data.message || "Connection successful" })
      } else {
        setTestResult({ ok: false, message: data.error || data.message || "Connection failed" })
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" })
    } finally {
      setTestingConnection(false)
    }
  }

  const startEdit = (partner: DeliveryPartner) => {
    setEditing(partner)

    // Build credential field values from existing (masked) credentials
    const credValues: Record<string, string> = {}
    if (partner.credentials) {
      for (const [k, v] of Object.entries(partner.credentials)) {
        credValues[k] = v || ""
      }
    }

    setForm({
      name: partner.name,
      code: partner.code,
      trackingUrlTemplate: partner.trackingUrlTemplate || "",
      contactEmail: partner.contactEmail || "",
      contactPhone: partner.contactPhone || "",
      isActive: partner.isActive,
      apiEnabled: partner.apiEnabled,
      testMode: partner.testMode,
      apiBaseUrl: partner.apiBaseUrl || "",
      webhookUrl: partner.webhookUrl || "",
      credentialFields: credValues,
      selectedProvider: "",
    })
    setApiSectionOpen(partner.apiEnabled)
    setTestResult(null)
    setShowForm(true)
  }

  const startAdd = () => {
    setEditing(null)
    setForm({
      name: "",
      code: "",
      trackingUrlTemplate: "",
      contactEmail: "",
      contactPhone: "",
      isActive: true,
      apiEnabled: false,
      testMode: false,
      apiBaseUrl: "",
      webhookUrl: "",
      credentialFields: {},
      selectedProvider: "",
    })
    setApiSectionOpen(false)
    setTestResult(null)
    setShowForm(true)
  }

  // Determine which credential fields to show based on built-in provider or partner code
  const activeCredFields = editing
    ? (editing.credentialFields || PROVIDER_CREDENTIAL_FIELDS[editing.code] || [])
    : form.selectedProvider
      ? PROVIDER_CREDENTIAL_FIELDS[form.selectedProvider] || []
      : []

  // When a built-in provider is selected during creation, auto-fill the code
  const handleProviderSelect = (provider: string) => {
    const fields = PROVIDER_CREDENTIAL_FIELDS[provider] || []
    const existingCreds = { ...form.credentialFields }
    // Reset credential fields to only those for the new provider
    const newCreds: Record<string, string> = {}
    for (const f of fields) {
      newCreds[f.key] = existingCreds[f.key] || ""
    }
    setForm({
      ...form,
      selectedProvider: provider,
      code: provider,
      name: form.name || PROVIDER_LABELS[provider] || provider,
      credentialFields: newCreds,
    })
  }

  if (loading) {
    return (
      <SkeletonTable />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Delivery Partners</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage courier and logistics partners</p>
        </div>
        <button onClick={startAdd} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition">
          <Plus size={16} /> Add Partner
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-lg">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{editing ? "Edit Partner" : "Add Partner"}</h2>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. DELHIVERY"
                disabled={!!editing}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tracking URL Template</label>
              <input type="text" value={form.trackingUrlTemplate} onChange={(e) => setForm({ ...form, trackingUrlTemplate: e.target.value })} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="https://example.com/track/{trackingNumber}" />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Use {"{trackingNumber}"} as placeholder for the actual tracking number</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Phone</label>
              <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* API Integration Section */}
          <div className="mt-6 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setApiSectionOpen(!apiSectionOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
            >
              <div className="flex items-center gap-2">
                <Plug size={16} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">API Integration</span>
                {form.apiEnabled && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Enabled</span>
                )}
              </div>
              {apiSectionOpen ? <ChevronUp size={16} className="text-gray-400 dark:text-gray-500" /> : <ChevronDown size={16} className="text-gray-400 dark:text-gray-500" />}
            </button>

            {apiSectionOpen && (
              <div className="p-4 space-y-4">
                {/* Enable API Integration */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="apiEnabled"
                    checked={form.apiEnabled}
                    onChange={(e) => setForm({ ...form, apiEnabled: e.target.checked })}
                    className="h-4 w-4 text-primary-600 dark:text-primary-400 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="apiEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable API Integration</label>
                </div>

                {form.apiEnabled && (
                  <>
                    {/* Built-in Provider dropdown (only when creating) */}
                    {!editing && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Built-in Provider</label>
                        <select
                          value={form.selectedProvider}
                          onChange={(e) => handleProviderSelect(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        >
                          <option value="">-- Select a provider --</option>
                          {BUILTIN_PROVIDERS.map((p) => (
                            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Selecting a built-in provider auto-fills the code and credential fields</p>
                      </div>
                    )}

                    {/* Dynamic Credential Fields */}
                    {activeCredFields.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Credentials</h4>
                        {activeCredFields.map((field) => (
                          <div key={field.key}>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <input
                              type="password"
                              value={form.credentialFields[field.key] || ""}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  credentialFields: { ...form.credentialFields, [field.key]: e.target.value },
                                })
                              }
                              placeholder={editing && form.credentialFields[field.key] ? "Enter new value to replace masked value" : `Enter ${field.label}`}
                              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Test Mode */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="testMode"
                        checked={form.testMode}
                        onChange={(e) => setForm({ ...form, testMode: e.target.checked })}
                        className="h-4 w-4 text-primary-600 dark:text-primary-400 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="testMode" className="text-sm font-medium text-gray-700 dark:text-gray-300">Test Mode</label>
                      <span className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full">Sandbox</span>
                    </div>

                    {/* API Base URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Base URL</label>
                      <input
                        type="text"
                        value={form.apiBaseUrl}
                        onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="https://api.example.com/v1 (for custom providers)"
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Leave empty to use the built-in provider default URL</p>
                    </div>

                    {/* Webhook URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                      <input
                        type="text"
                        value={form.webhookUrl}
                        onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="https://your-store.com/api/webhooks/delivery-status"
                      />
                    </div>

                    {/* Test Connection */}
                    {editing && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={testConnection}
                          disabled={testingConnection}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                        >
                          {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                          Test Connection
                        </button>
                        {testResult && (
                          <div className={`flex items-center gap-2 mt-2 text-sm px-3 py-2 rounded-lg ${testResult.ok ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30" : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30"}`}>
                            {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
            <button onClick={savePartner} disabled={saving || !form.name || !form.code} className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Partner</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tracking URL</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Orders</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">API</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {partners.map((p) => (
              <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!p.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-gray-400 dark:text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{p.code}</td>
                <td className="px-4 py-3">
                  {p.trackingUrlTemplate ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px] block">{p.trackingUrlTemplate}</span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.contactEmail && <p className="text-xs text-gray-600 dark:text-gray-400">{p.contactEmail}</p>}
                  {p.contactPhone && <p className="text-xs text-gray-500 dark:text-gray-400">{p.contactPhone}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p._count?.orders ?? 0}</td>
                <td className="px-4 py-3">
                  {p.apiEnabled && p.testMode ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} /> Test Mode
                    </span>
                  ) : p.apiEnabled && p.credentials ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      Not configured
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(p)} className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                    {p.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Edit3 size={14} /></button>
                    <button onClick={() => deletePartner(p.id)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partners.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Truck size={40} className="mx-auto mb-3" />
            <p>No delivery partners yet</p>
          </div>
        )}
      </div>
    </div>
  )
}