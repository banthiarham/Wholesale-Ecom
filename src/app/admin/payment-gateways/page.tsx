"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2, PlusCircle, MinusCircle } from "lucide-react"

interface Gateway {
  id: string
  provider: string
  label: string
  description: string | null
  isActive: boolean
  isDefault: boolean
  testMode: boolean
  credentials: Record<string, string> | null
  credentialFields: { key: string; label: string; required: boolean }[] | null
  gatewayUrl: string | null
  webhookUrl: string | null
  settings: Record<string, any> | null
  createdAt: string
  updatedAt: string
}

const BUILTIN_PROVIDERS = ["CCAVENUE", "RAZORPAY", "STRIPE", "PAYU"] as const

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string; required: boolean }[]> = {
  CCAVENUE: [
    { key: "merchantId", label: "Merchant ID", required: true },
    { key: "accessCode", label: "Access Code", required: true },
    { key: "workingKey", label: "Working Key", required: true },
  ],
  RAZORPAY: [
    { key: "keyId", label: "Key ID", required: true },
    { key: "keySecret", label: "Key Secret", required: true },
  ],
  STRIPE: [
    { key: "secretKey", label: "Secret Key", required: true },
  ],
  PAYU: [
    { key: "merchantKey", label: "Merchant Key", required: true },
    { key: "salt", label: "Salt", required: true },
    { key: "successUrl", label: "Success URL", required: false },
    { key: "failureUrl", label: "Failure URL", required: false },
    { key: "productInfo", label: "Product Info", required: false },
  ],
}

const PROVIDER_LABELS: Record<string, string> = {
  CCAVENUE: "CCAvenue",
  RAZORPAY: "Razorpay",
  STRIPE: "Stripe",
  PAYU: "PayU",
}

interface CustomCredField {
  key: string
  label: string
  required: boolean
}

const defaultForm = {
  providerType: "builtin" as "builtin" | "custom",
  provider: "CCAVENUE",
  customProviderName: "",
  label: "",
  description: "",
  isActive: true,
  isDefault: false,
  testMode: true,
  credentials: {} as Record<string, string>,
  customCredFields: [] as CustomCredField[],
  gatewayUrl: "",
  webhookUrl: "",
}

export default function AdminPaymentGatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [filtered, setFiltered] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Gateway | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...defaultForm })
  const [showCreds, setShowCreds] = useState<Record<string, boolean>>({})

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadGateways()
  }, [token])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      gateways.filter(
        (g) =>
          g.provider.toLowerCase().includes(q) ||
          g.label.toLowerCase().includes(q)
      )
    )
  }, [gateways, search])

  const loadGateways = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/payment-gateways", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setGateways(Array.isArray(data) ? data : data.gateways ?? [])
      setFiltered(Array.isArray(data) ? data : data.gateways ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ ...defaultForm, credentials: {}, customCredFields: [] })
    setEditing(null)
    setShowForm(false)
  }

  const openEdit = (g: Gateway) => {
    setEditing(g)
    const creds: Record<string, string> = {}
    if (g.credentials && typeof g.credentials === "object") {
      for (const [k, v] of Object.entries(g.credentials)) {
        creds[k] = typeof v === "string" ? v : String(v)
      }
    }
    const isBuiltin = BUILTIN_PROVIDERS.includes(g.provider as any)
    setForm({
      providerType: isBuiltin ? "builtin" : "custom",
      provider: isBuiltin ? g.provider : "CCAVENUE",
      customProviderName: isBuiltin ? "" : g.provider,
      label: g.label,
      description: g.description || "",
      isActive: g.isActive,
      isDefault: g.isDefault,
      testMode: g.testMode,
      credentials: creds,
      customCredFields: g.credentialFields || [],
      gatewayUrl: g.gatewayUrl || "",
      webhookUrl: g.webhookUrl || "",
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const effectiveProvider = form.providerType === "custom" ? form.customProviderName.toUpperCase().replace(/\s+/g, "_") : form.provider

    if (!effectiveProvider) {
      alert("Provider name is required")
      setSaving(false)
      return
    }

    // Build credentials — for custom, use customCredFields; for builtin, use predefined
    const credFields = form.providerType === "custom"
      ? form.customCredFields
      : (CREDENTIAL_FIELDS[form.provider] || [])

    const credentials: Record<string, string> = {}
    for (const field of credFields) {
      const val = form.credentials[field.key]?.trim()
      if (val) credentials[field.key] = val
    }

    const body: any = {
      provider: effectiveProvider,
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      isActive: form.isActive,
      isDefault: form.isDefault,
      testMode: form.testMode,
      credentials,
    }

    if (form.providerType === "custom") {
      body.credentialFields = form.customCredFields.length > 0 ? form.customCredFields : undefined
      body.gatewayUrl = form.gatewayUrl.trim() || undefined
      body.webhookUrl = form.webhookUrl.trim() || undefined
    }

    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(
        editing ? `/api/payment-gateways/${editing.id}` : "/api/payment-gateways",
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify(body),
        }
      )
      if (res.ok) {
        resetForm()
        loadGateways()
      } else {
        const d = await res.json()
        alert(d.message || "Failed to save gateway")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to save gateway")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payment gateway configuration?")) return
    const t = localStorage.getItem("token")!
    await fetch(`/api/payment-gateways/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    })
    setGateways((prev) => prev.filter((g) => g.id !== id))
  }

  const toggleCredVisibility = (id: string) => {
    setShowCreds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleProviderChange = (provider: string) => {
    setForm((prev) => ({
      ...prev,
      provider,
      credentials: {},
      label: prev.label || PROVIDER_LABELS[provider] || provider,
    }))
  }

  const updateCredential = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }))
  }

  const addCustomCredField = () => {
    setForm((prev) => ({
      ...prev,
      customCredFields: [...prev.customCredFields, { key: "", label: "", required: true }],
    }))
  }

  const removeCustomCredField = (index: number) => {
    setForm((prev) => {
      const fields = [...prev.customCredFields]
      const removed = fields[index]
      fields.splice(index, 1)
      const newCreds = { ...prev.credentials }
      if (removed?.key) delete newCreds[removed.key]
      return { ...prev, customCredFields: fields, credentials: newCreds }
    })
  }

  const updateCustomCredField = (index: number, field: "key" | "label" | "required", value: string | boolean) => {
    setForm((prev) => {
      const fields = [...prev.customCredFields]
      const oldKey = fields[index].key
      fields[index] = { ...fields[index], [field]: value }
      // If key changed, rename in credentials too
      if (field === "key" && typeof value === "string" && oldKey !== value) {
        const newCreds = { ...prev.credentials }
        if (oldKey && newCreds[oldKey] !== undefined) {
          newCreds[value] = newCreds[oldKey]
          delete newCreds[oldKey]
        }
        return { ...prev, customCredFields: fields, credentials: newCreds }
      }
      return { ...prev, customCredFields: fields }
    })
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )

  const currentCredFields = form.providerType === "custom"
    ? form.customCredFields
    : (CREDENTIAL_FIELDS[form.provider] || [])

  const isCustom = form.providerType === "custom"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Payment Gateways</h1>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
        >
          <Plus size={16} /> Add Gateway
        </button>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search gateways..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? "Edit Gateway" : "Add Gateway"}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Provider type selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {!editing && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gateway Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="providerType"
                        checked={form.providerType === "builtin"}
                        onChange={() => setForm((prev) => ({ ...prev, providerType: "builtin", credentials: {}, customCredFields: [] }))}
                        className="accent-primary-600"
                      />
                      <span className="text-sm text-gray-700">Built-in Provider</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="providerType"
                        checked={form.providerType === "custom"}
                        onChange={() => setForm((prev) => ({ ...prev, providerType: "custom", credentials: {}, customCredFields: [{ key: "", label: "", required: true }] }))}
                        className="accent-primary-600"
                      />
                      <span className="text-sm text-gray-700">Custom Gateway</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Built-in provider select */}
              {form.providerType === "builtin" && (
                <select
                  value={form.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  disabled={!!editing}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {BUILTIN_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              )}

              {/* Custom provider name */}
              {form.providerType === "custom" && (
                <input
                  required
                  placeholder="Provider name (e.g. PAYPAL, PHONEPE)"
                  value={form.customProviderName}
                  onChange={(e) => setForm({ ...form, customProviderName: e.target.value })}
                  disabled={!!editing}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              )}

              <input
                required
                placeholder="Label (e.g. Razorpay Test)"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Custom gateway: credential field builder */}
            {isCustom && (
              <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Credential Fields</label>
                  <button
                    type="button"
                    onClick={addCustomCredField}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                  >
                    <PlusCircle size={14} /> Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {form.customCredFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        required
                        placeholder="Field key (e.g. apiKey)"
                        value={field.key}
                        onChange={(e) => updateCustomCredField(idx, "key", e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <input
                        required
                        placeholder="Label (e.g. API Key)"
                        value={field.label}
                        onChange={(e) => updateCustomCredField(idx, "label", e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateCustomCredField(idx, "required", e.target.checked)}
                          className="accent-primary-600"
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomCredField(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <MinusCircle size={16} />
                      </button>
                    </div>
                  ))}
                  {form.customCredFields.length === 0 && (
                    <p className="text-xs text-gray-400">No credential fields defined. Add at least one.</p>
                  )}
                </div>
              </div>
            )}

            {/* Custom gateway: URL fields */}
            {isCustom && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  required
                  placeholder="Gateway URL (e.g. https://pay.example.com/initiate)"
                  value={form.gatewayUrl}
                  onChange={(e) => setForm({ ...form, gatewayUrl: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  placeholder="Webhook URL (optional, e.g. https://pay.example.com/callback)"
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {/* Credential value inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentCredFields.map((field) => (
                <input
                  key={field.key || `field-${Math.random()}`}
                  required={field.required}
                  type={isSensitiveField(field.key) ? "password" : "text"}
                  placeholder={`${field.label}${field.required ? " *" : ""}`}
                  value={form.credentials[field.key] || ""}
                  onChange={(e) => updateCredential(field.key, e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              ))}
            </div>

            {/* Toggle fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 accent-primary-600"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded border-gray-300 accent-primary-600"
                />
                <span className="text-sm text-gray-700">Default Gateway</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.testMode}
                  onChange={(e) => setForm({ ...form, testMode: e.target.checked })}
                  className="rounded border-gray-300 accent-primary-600"
                />
                <span className="text-sm text-gray-700">Test Mode</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <p className="text-gray-600">No payment gateways configured.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Label</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Mode</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Credentials</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Gateway URL</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((g) => {
                const isBuiltin = BUILTIN_PROVIDERS.includes(g.provider as any)
                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isBuiltin ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                        {PROVIDER_LABELS[g.provider] || g.provider}
                        {!isBuiltin && <span className="ml-1 text-[10px]">(custom)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{g.label}</div>
                      {g.description && (
                        <div className="text-xs text-gray-500">{g.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            g.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {g.isActive ? "Active" : "Inactive"}
                        </span>
                        {g.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          g.testMode
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {g.testMode ? "Test" : "Live"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {g.credentials && typeof g.credentials === "object" && Object.keys(g.credentials).length > 0 ? (
                        <div className="space-y-0.5">
                          {Object.entries(g.credentials).slice(0, showCreds[g.id] ? undefined : 2).map(([k, v]) => (
                            <div key={k} className="text-xs text-gray-500">
                              <span className="font-medium text-gray-600">{k}:</span>{" "}
                              <span className="font-mono">{showCreds[g.id] ? v : "••••••••"}</span>
                            </div>
                          ))}
                          {Object.keys(g.credentials).length > 2 && !showCreds[g.id] && (
                            <div className="text-xs text-gray-400">+{Object.keys(g.credentials).length - 2} more</div>
                          )}
                          <button
                            onClick={() => toggleCredVisibility(g.id)}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            {showCreds[g.id] ? "Hide" : "Show"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {g.gatewayUrl ? (
                        <span className="text-xs font-mono text-gray-500 truncate max-w-[200px] block" title={g.gatewayUrl}>{g.gatewayUrl}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(g)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function isSensitiveField(key: string): boolean {
  const lower = key.toLowerCase()
  return lower.includes("secret") || lower.includes("key") || lower.includes("salt") || lower.includes("workingkey") || lower.includes("token")
}