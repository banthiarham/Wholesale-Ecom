"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Check, Trash2, ArrowLeft } from "lucide-react"

interface Notification {
  id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch("/api/notifications?unreadOnly=false", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setNotifications(data); setLoading(false) })
    fetch("/api/notifications/unread-count", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.count))
  }, [token])

  const markRead = (id: string) => {
    if (!token) return
    fetch(`/api/notifications/${id}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
        setUnreadCount((c) => Math.max(0, c - 1))
      })
  }

  const markAllRead = () => {
    if (!token) return
    fetch("/api/notifications/read-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
      })
  }

  const remove = (id: string) => {
    if (!token) return
    fetch(`/api/notifications/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => setNotifications((prev) => prev.filter((n) => n.id !== id)))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4">
            <Link href="/" className="text-gray-600 hover:text-primary-600">Home</Link>
            <Link href="/products" className="text-gray-600 hover:text-primary-600">Products</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to home</Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{unreadCount}</span>
            )}
          </div>
          {notifications.some((n) => !n.isRead) && (
            <button onClick={markAllRead} className="px-4 py-2 text-sm text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition">
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <Bell size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className={`bg-white rounded-lg p-4 shadow-sm flex items-start justify-between gap-4 ${!n.isRead ? "border-l-4 border-primary-600" : ""}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase text-gray-400">{n.type}</span>
                    <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{n.title}</h3>
                  <p className="text-sm text-gray-600">{n.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!n.isRead && (
                    <button onClick={() => markRead(n.id)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition" title="Mark as read">
                      <Check size={18} />
                    </button>
                  )}
                  <button onClick={() => remove(n.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
