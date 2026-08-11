"use client"

import { useEffect, useState } from "react"
import { Mail, Save, Loader2, CheckCircle, X, Eye, EyeOff, Send } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface SmtpSettings {
  id: string
  host: string
  port: number
  username: string
  fromName: string
  fromEmail: string
  isActive: boolean
  hasPassword: boolean
}

const DEFAULT_FORM = {
  host: "",
  port: 587,
  username: "",
  password: "",
  fromName: "WholesaleX Pro",
  fromEmail: "",
}

export default function AdminSmtpSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [hasPassword, setHasPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ ...DEFAULT_FORM })

  const [testTo, setTestTo] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/smtp-settings", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const s: SmtpSettings | null = data.settings
      if (s) {
        setForm({
          host: s.host,
          port: s.port,
          username: s.username,
          password: "",
          fromName: s.fromName,
          fromEmail: s.fromEmail,
        })
        setHasPassword(!!s.hasPassword)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const update = <K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveSettings = async () => {
    setSaving(true)
    setError("")
    setSuccess(false)
    try {
      const body: Record<string, any> = {
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        fromName: form.fromName.trim(),
        fromEmail: form.fromEmail.trim(),
      }
      if (form.password.trim()) body.password = form.password.trim()

      const res = await fetch("/api/smtp-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to save SMTP settings")

      setHasPassword(!!data.settings?.hasPassword)
      setForm((prev) => ({ ...prev, password: "" }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err?.message || "Failed to save SMTP settings")
      setTimeout(() => setError(""), 4000)
    } finally {
      setSaving(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testTo.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const body = {
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        password: form.password.trim() || undefined,
        fromName: form.fromName.trim(),
        fromEmail: form.fromEmail.trim(),
        to: testTo.trim(),
      }
      const res = await fetch("/api/smtp-settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Failed to send test email" })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <SkeletonTable rows={4} cols={2} />

  const inputClass =
    "w-full px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Mail size={22} /> Email / SMTP Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure the SMTP server used for signup OTP emails and other system notifications.
          </p>
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

      <div className="admin-card-static p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>SMTP Host</label>
            <input
              required
              placeholder="smtp.gmail.com"
              value={form.host}
              onChange={(e) => update("host", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>SMTP Port</label>
            <input
              required
              type="number"
              min={1}
              max={65535}
              placeholder="587"
              value={form.port}
              onChange={(e) => update("port", Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>SMTP Username</label>
            <input
              required
              placeholder="you@example.com"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              SMTP Password
              {hasPassword && (
                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                  (saved — leave blank to keep it)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={hasPassword ? "••••••••" : "Required for initial setup"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>From Name</label>
            <input
              required
              placeholder="WholesaleX Pro"
              value={form.fromName}
              onChange={(e) => update("fromName", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>From Email</label>
            <input
              required
              type="email"
              placeholder="noreply@wholesalex.com"
              value={form.fromEmail}
              onChange={(e) => update("fromEmail", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          The password is encrypted at rest and is never shown or returned by the API once saved.
        </p>
      </div>

      <div className="admin-card-static p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Test Email</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Send a test email using the settings above (unsaved changes are used if present, otherwise the saved configuration).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Send test email to..."
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className={`${inputClass} sm:max-w-xs`}
          />
          <button
            onClick={sendTestEmail}
            disabled={testing || !testTo.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-50"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send Test Email
          </button>
        </div>
        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
              testResult.success
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {testResult.success ? <CheckCircle size={16} /> : <X size={16} />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  )
}
