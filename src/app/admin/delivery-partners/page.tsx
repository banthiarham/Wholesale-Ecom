"use client"

import { useEffect, useState } from "react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { Accordion } from "@/components/admin/Accordion"
import { useToast } from "@/components/ui/Toast"
import {
  Truck,
  Plus,
  Edit3,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Plug,
  Copy,
  Check,
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

interface CredentialField {
  key: string
  label: string
  required: boolean
}

const BUILTIN_PROVIDERS = ["SHIPROCKET", "SHIPMOZO"] as const

const PROVIDER_LABELS: Record<string, string> = {
  SHIPROCKET: "Shiprocket",
  SHIPMOZO: "Shipmozo",
}

function computeWebhookUrl(code: string) {
  if (!code) return ""
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  return `${base}/api/v1/delivery-partners/webhook/${code.toLowerCase()}`
}

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function errorMessage(data: any, fallback: string) {
  if (!data) return fallback
  if (Array.isArray(data.message)) return data.message.join(", ")
  return data.message || data.error || fallback
}

export default function AdminDeliveryPartnersPage() {
  const { showToast } = useToast()
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DeliveryPartner | null>(null)
  const [saving, setSaving] = useState(false)

  // Identity-only fields (name, code, contact info) - independent of credentials.
  const [form, setForm] = useState({
    name: "",
    code: "",
    trackingUrlTemplate: "",
    contactEmail: "",
    contactPhone: "",
    isActive: true,
    selectedProvider: "",
  })

  // API Integration panel state - saved independently via its own action.
  const [apiOpen, setApiOpen] = useState(false)
  const [envMode, setEnvMode] = useState<"test" | "production">("test")
  const [credFieldDefs, setCredFieldDefs] = useState<CredentialField[]>([])
  const [credFieldsLoading, setCredFieldsLoading] = useState(false)
  const [credValues, setCredValues] = useState<Record<string, string>>({})
  const [webhookSecretValue, setWebhookSecretValue] = useState("")
  const [savingCreds, setSavingCreds] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""

  useEffect(() => {
    fetch("/api/delivery-partners/all", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPartners(Array.isArray(data) ? data : []))
      .catch((err) => { console.error("Failed to fetch delivery partners:", err) })
      .finally(() => setLoading(false))
  }, [])

  // Fetch the credential field schema for whichever provider is active in the form,
  // so Authentication fields are always sourced from the backend provider config -
  // this is what lets a future partner "just work" without any frontend changes.
  useEffect(() => {
    const code = editing ? editing.code : form.selectedProvider
    if (!showForm || !code) {
      setCredFieldDefs([])
      return
    }
    setCredFieldsLoading(true)
    fetch(`/api/delivery-partners/credential-fields/${code}`)
      .then((r) => r.json())
      .then((data) => setCredFieldDefs(Array.isArray(data?.credentialFields) ? data.credentialFields : []))
      .catch(() => setCredFieldDefs([]))
      .finally(() => setCredFieldsLoading(false))
  }, [showForm, editing, form.selectedProvider])

  // Accordion open state persists per-partner across refreshes and when switching
  // which partner is being edited.
  useEffect(() => {
    if (!showForm) return
    const key = editing ? `dp-api-open:${editing.id}` : "dp-api-open:new"
    let stored: string | null = null
    try { stored = localStorage.getItem(key) } catch {}
    setApiOpen(stored !== null ? stored === "1" : !!editing?.apiEnabled)
  }, [showForm, editing])

  const toggleApiOpen = () => {
    setApiOpen((prev) => {
      const next = !prev
      const key = editing ? `dp-api-open:${editing.id}` : "dp-api-open:new"
      try { localStorage.setItem(key, next ? "1" : "0") } catch {}
      return next
    })
  }

  const collectNonEmptyCreds = () => {
    const out: Record<string, string> = {}
    for (const f of credFieldDefs) {
      const v = credValues[f.key]
      if (v && v.trim()) out[f.key] = v.trim()
    }
    if (webhookSecretValue.trim()) out.webhookSecret = webhookSecretValue.trim()
    return out
  }

  const savePartner = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      showToast("error", "Name and code are required")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const body = {
          name: form.name,
          trackingUrlTemplate: form.trackingUrlTemplate || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
          isActive: form.isActive,
        }
        const res = await fetch(`/api/delivery-partners/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        const data = await safeJson(res)
        if (!res.ok) throw new Error(errorMessage(data, "Failed to update partner"))
        setPartners((prev) => prev.map((p) => (p.id === data.id ? data : p)))
        showToast("success", "Partner updated")
      } else {
        const nonEmptyCreds = collectNonEmptyCreds()
        const hasCreds = Object.keys(nonEmptyCreds).length > 0
        const body: Record<string, any> = {
          name: form.name,
          code: form.code,
          trackingUrlTemplate: form.trackingUrlTemplate || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
          isActive: form.isActive,
          testMode: envMode === "test",
          webhookUrl: computeWebhookUrl(form.code),
          apiEnabled: hasCreds,
          credentials: hasCreds ? nonEmptyCreds : undefined,
        }
        const res = await fetch("/api/delivery-partners", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        const data = await safeJson(res)
        if (!res.ok) throw new Error(errorMessage(data, "Failed to create partner"))
        setPartners((prev) => [...prev, data])
        showToast("success", "Partner created")
      }
      setShowForm(false)
      setEditing(null)
    } catch (err: any) {
      showToast("error", err?.message || "Failed to save partner")
    } finally {
      setSaving(false)
    }
  }

  const saveCredentials = async () => {
    if (!editing) return
    const nonEmpty = collectNonEmptyCreds()
    const alreadyConfigured = !!editing.apiEnabled && !!editing.credentials
    if (!alreadyConfigured) {
      const missing = credFieldDefs.filter((f) => f.required && !credValues[f.key]?.trim())
      if (missing.length > 0) {
        showToast("error", `Required: ${missing.map((f) => f.label).join(", ")}`)
        return
      }
    }
    setSavingCreds(true)
    try {
      const body: Record<string, any> = {
        testMode: envMode === "test",
        webhookUrl: computeWebhookUrl(editing.code),
      }
      if (Object.keys(nonEmpty).length > 0) body.credentials = nonEmpty
      const res = await fetch(`/api/delivery-partners/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(errorMessage(data, "Failed to save credentials"))
      setPartners((prev) => prev.map((p) => (p.id === data.id ? data : p)))
      setEditing(data)
      setCredValues({})
      setWebhookSecretValue("")
      showToast("success", "Credentials saved")
    } catch (err: any) {
      showToast("error", err?.message || "Failed to save credentials")
    } finally {
      setSavingCreds(false)
    }
  }

  const resetCredentials = () => {
    setCredValues({})
    setWebhookSecretValue("")
    setEnvMode((editing?.testMode ?? true) ? "test" : "production")
    setTestResult(null)
    showToast("info", "Form reset")
  }

  const testConnectionAction = async () => {
    if (!editing) return
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/delivery-partners/${editing.id}/test-connection`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await safeJson(res)
      if (res.ok && data?.success) {
        setTestResult({ ok: true, message: data.message || "Connection successful" })
        showToast("success", data.message || "Connection successful")
      } else {
        const msg = errorMessage(data, "Connection failed")
        setTestResult({ ok: false, message: msg })
        showToast("error", msg)
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" })
      showToast("error", "Network error while testing connection")
    } finally {
      setTestingConnection(false)
    }
  }

  const copyWebhookUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showToast("success", "Webhook URL copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast("error", "Couldn't copy — copy it manually")
    }
  }

  const deletePartner = async (id: string) => {
    if (!confirm("Deactivate this partner?")) return
    try {
      const res = await fetch(`/api/delivery-partners/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      const updated = await safeJson(res)
      if (updated?.isActive === false) {
        setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)))
      } else {
        setPartners((prev) => prev.filter((p) => p.id !== id))
      }
    } catch {
      showToast("error", "Failed to deactivate partner")
    }
  }

  const toggleActive = async (partner: DeliveryPartner) => {
    try {
      const res = await fetch(`/api/delivery-partners/${partner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !partner.isActive }),
      })
      const updated = await safeJson(res)
      if (!res.ok) throw new Error(errorMessage(updated, "Failed to update partner"))
      setPartners((prev) => prev.map((p) => (p.id === partner.id ? updated : p)))
    } catch (err: any) {
      showToast("error", err?.message || "Failed to update partner")
    }
  }

  const startEdit = (partner: DeliveryPartner) => {
    setEditing(partner)
    setForm({
      name: partner.name,
      code: partner.code,
      trackingUrlTemplate: partner.trackingUrlTemplate || "",
      contactEmail: partner.contactEmail || "",
      contactPhone: partner.contactPhone || "",
      isActive: partner.isActive,
      selectedProvider: "",
    })
    setEnvMode(partner.testMode ? "test" : "production")
    setCredValues({})
    setWebhookSecretValue("")
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
      selectedProvider: "",
    })
    setEnvMode("test")
    setCredValues({})
    setWebhookSecretValue("")
    setTestResult(null)
    setShowForm(true)
  }

  const handleProviderSelect = (provider: string) => {
    setForm((prev) => ({
      ...prev,
      selectedProvider: provider,
      code: provider,
      name: prev.name || PROVIDER_LABELS[provider] || provider,
    }))
    setCredValues({})
  }

  const configured = !!(editing?.apiEnabled && editing?.credentials)
  const activeCode = editing ? editing.code : form.code
  const webhookUrl = computeWebhookUrl(activeCode)

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

      {showForm && (
        <div className="admin-card-static p-6">
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
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                placeholder="e.g. SHIPROCKET"
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
          <Accordion
            open={apiOpen}
            onToggle={toggleApiOpen}
            icon={<Plug size={16} className="text-gray-500 dark:text-gray-400" />}
            title="API Integration"
            badge={
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${configured ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                {configured ? "Configured" : "Not Configured"}
              </span>
            }
            className="mt-6"
          >
            <div className="p-4 space-y-6 border-t border-gray-200 dark:border-gray-800">
              {/* Built-in provider select — creation only, since code is locked once a partner exists */}
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Built-in Provider</label>
                  <select
                    value={form.selectedProvider}
                    onChange={(e) => handleProviderSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Select a provider --</option>
                    {BUILTIN_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Selecting a provider auto-fills the code and its credential fields</p>
                </div>
              )}

              {/* General Settings */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">General Settings</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Environment</label>
                  <select
                    value={envMode}
                    onChange={(e) => setEnvMode(e.target.value as "test" | "production")}
                    className="w-full sm:w-64 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="test">Test / Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              {/* Authentication */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Authentication</h4>
                {credFieldsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                    <Loader2 size={14} className="animate-spin" /> Loading fields…
                  </div>
                ) : credFieldDefs.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {editing ? "This provider has no credential fields configured." : "Select a provider above to see its credential fields."}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {credFieldDefs.map((field) => {
                      const isSaved = !!editing?.credentials?.[field.key]
                      return (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          <input
                            type="password"
                            autoComplete="off"
                            value={credValues[field.key] || ""}
                            onChange={(e) => setCredValues({ ...credValues, [field.key]: e.target.value })}
                            placeholder={isSaved ? "•••••••• (saved — enter to replace)" : `Enter ${field.label}`}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Webhook */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Webhook</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800/50 bg-gray-50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => copyWebhookUrl(webhookUrl)}
                        disabled={!webhookUrl}
                        className="shrink-0 p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                        aria-label="Copy webhook URL"
                      >
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Not live yet — will activate once real API integration is enabled. Paste it into the partner dashboard when ready.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Webhook Secret</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={webhookSecretValue}
                      onChange={(e) => setWebhookSecretValue(e.target.value)}
                      placeholder={editing?.credentials?.webhookSecret ? "•••••••• (saved — enter to replace)" : "Enter webhook secret"}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              {editing ? (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={testConnectionAction}
                      disabled={testingConnection || !configured}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                      title={!configured ? "Save credentials first" : undefined}
                    >
                      {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={saveCredentials}
                      disabled={savingCreds}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                    >
                      {savingCreds ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save Credentials
                    </button>
                    <button
                      type="button"
                      onClick={resetCredentials}
                      disabled={savingCreds || testingConnection}
                      className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition disabled:opacity-50"
                    >
                      Reset
                    </button>
                  </div>
                  {testResult && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${testResult.ok ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30" : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30"}`}>
                      {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                  Save the partner first to unlock Test Connection and independent credential saving. Any credentials entered above will be stored when you create the partner.
                </p>
              )}
            </div>
          </Accordion>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
            <button onClick={savePartner} disabled={saving || !form.name || !form.code} className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="admin-card-static overflow-hidden">
        <div className="overflow-x-auto">
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
                  {p.apiEnabled && p.credentials ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Configured{p.testMode ? " · Sandbox" : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      Not Configured
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
        </div>
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
