"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Check, Trash2, ArrowLeft, Package, CreditCard, FileText, Tag, Settings, Award, RefreshCcw } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"

interface Notification {
  id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: any; className: string }> = {
  ORDER: { icon: Package, className: "bg-primary-50 text-primary-600" },
  PAYMENT: { icon: CreditCard, className: "bg-green-50 text-green-600" },
  RFQ: { icon: FileText, className: "bg-cyan-50 text-cyan-600" },
  QUOTE: { icon: FileText, className: "bg-cyan-50 text-cyan-600" },
  PROMOTION: { icon: Tag, className: "bg-amber-50 text-amber-600" },
  SYSTEM: { icon: Settings, className: "bg-gray-100 text-gray-500" },
  LOYALTY: { icon: Award, className: "bg-purple-50 text-purple-600" },
  RETURN: { icon: RefreshCcw, className: "bg-orange-50 text-orange-600" },
}

function typeConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Bell, className: "bg-gray-100 text-gray-500" }
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
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container max-w-4xl py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6 text-sm font-medium transition-colors"><ArrowLeft size={16} /> Back to home</Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="eyebrow">Account</span>
            <div className="flex items-center gap-3">
              <h1 className="heading-xl">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{unreadCount}</span>
              )}
            </div>
          </div>
          {notifications.some((n) => !n.isRead) && (
            <button onClick={markAllRead} className="btn-sm-outline">
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Updates about your orders, payments, and offers will show up here."
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const { icon: Icon, className } = typeConfig(n.type)
              return (
                <div
                  key={n.id}
                  className={`card-interactive p-4 flex items-start gap-4 ${!n.isRead ? "bg-primary-50/30 border-primary-100" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${className}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{n.type}</span>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                      <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{n.title}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <button onClick={() => markRead(n.id)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Mark as read">
                        <Check size={16} />
                      </button>
                    )}
                    <button onClick={() => remove(n.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
