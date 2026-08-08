"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PackageOpen, Layers, Wallet, CalendarDays, MessageSquare, Clock, CheckCircle2, XCircle, Paperclip } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"

interface BulkOrderRequest {
  id: string
  bulkOrderNumber: string
  status: "PENDING" | "ACCEPTED" | "REJECTED"
  products: string
  quantity: string
  budget: string
  expectedDeliveryDate: string
  message: string
  attachmentUrl: string | null
  adminComment: string | null
  createdAt: string
}

const STATUS_META: Record<BulkOrderRequest["status"], { label: string; icon: any; className: string }> = {
  PENDING: { label: "Pending Review", icon: Clock, className: "bg-amber-100 text-amber-700" },
  ACCEPTED: { label: "Accepted", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "bg-red-100 text-red-700" },
}

const POLL_INTERVAL_MS = 20000

export default function MyBulkOrderRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<BulkOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback((silent = false) => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    if (!silent) setLoading(true)
    fetch("/api/bulk-orders/mine", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setRequests(data.bulkOrders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/60">
        <div className="section-container py-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="section-container py-10 lg:py-14">
        <div className="max-w-2xl mb-8">
          <span className="eyebrow">B2B Wholesale</span>
          <h1 className="heading-xl mb-2">My Bulk Quote Requests</h1>
          <p className="body-lg">Track the status of your bulk quote requests and any notes from our team.</p>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No bulk quote requests yet"
            description="Submit a request and we'll get back to you with custom wholesale pricing."
            action={{ label: "Request a Bulk Quote", href: "/bulk-orders/request" }}
          />
        ) : (
          <div className="max-w-3xl space-y-4">
            {requests.map((r) => {
              const meta = STATUS_META[r.status]
              const StatusIcon = meta.icon
              return (
                <div key={r.id} className="card-base-static p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{r.bulkOrderNumber}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Submitted {new Date(r.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${meta.className}`}>
                      <StatusIcon size={12} /> {meta.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Products</p>
                      <p className="text-gray-800">{r.products}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5"><Layers size={11} /> Quantity</p>
                      <p className="text-gray-800">{r.quantity}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5"><Wallet size={11} /> Budget</p>
                      <p className="text-gray-800">{r.budget}</p>
                    </div>
                  </div>

                  <p className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    <CalendarDays size={11} /> Expected Delivery
                  </p>
                  <p className="text-sm text-gray-800 mb-3">{new Date(r.expectedDeliveryDate).toLocaleDateString("en-IN")}</p>

                  {r.attachmentUrl && (
                    <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 mb-3">
                      <Paperclip size={13} /> View attachment
                    </a>
                  )}

                  {r.status !== "PENDING" && r.adminComment && (
                    <div className={`mt-2 p-3 rounded-xl text-sm flex gap-2 ${r.status === "ACCEPTED" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                      <MessageSquare size={15} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide mb-0.5">Note from our team</p>
                        <p>{r.adminComment}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
