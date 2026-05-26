"use client"

import { useState } from "react"
import { Bell, Send, X } from "lucide-react"

interface SentNotification {
  type: string
  userId: string
  title: string
  message: string
  sentAt: string
}

const notificationTypes = [
  { value: "ORDER", label: "Order", color: "bg-blue-50 text-blue-700" },
  { value: "PAYMENT", label: "Payment", color: "bg-green-50 text-green-700" },
  { value: "RFQ", label: "RFQ", color: "bg-yellow-50 text-yellow-700" },
  { value: "QUOTE", label: "Quote", color: "bg-purple-50 text-purple-700" },
  { value: "PROMOTION", label: "Promotion", color: "bg-pink-50 text-pink-700" },
  { value: "SYSTEM", label: "System", color: "bg-gray-50 text-gray-700" },
  { value: "LOYALTY", label: "Loyalty", color: "bg-amber-50 text-amber-700" },
  { value: "RETURN", label: "Return", color: "bg-red-50 text-red-700" },
]

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ userId: "", type: "SYSTEM", title: "", message: "" })
  const [sentLog, setSentLog] = useState<SentNotification[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const loadUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")!
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsers(data.users ?? [])
      setUsersLoaded(true)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true); setError(""); setSuccess("")
    const token = localStorage.getItem("token")!
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSentLog((prev) => [{ type: form.type, userId: form.userId, title: form.title, message: form.message, sentAt: new Date().toISOString() }, ...prev])
        setForm({ userId: "", type: "SYSTEM", title: "", message: "" })
        setSuccess("Notification sent successfully!")
      } else {
        const d = await res.json()
        setError(d.message || "Failed to send notification")
      }
    } catch (e) { setError("Failed to send notification") } finally { setSending(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Notification</h2>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex flex-wrap gap-2">
              {notificationTypes.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${form.type === t.value ? `${t.color} ring-2 ring-primary-300` : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
            {!usersLoaded ? (
              <button type="button" onClick={loadUsers} disabled={loading} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                {loading ? "Loading..." : "Load Users"}
              </button>
            ) : (
              <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select a user...</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email}) — {u.role}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notification title" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Notification message..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          <button type="submit" disabled={sending || !form.userId} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 transition">
            <Send size={16} /> {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>
      </div>

      {sentLog.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently Sent</h2>
          <div className="space-y-3">
            {sentLog.map((n, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Bell size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-900">{n.title}</p><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${notificationTypes.find((t) => t.value === n.type)?.color || "bg-gray-50 text-gray-600"}`}>{n.type}</span></div>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.sentAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}