"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RotateCcw, Package, ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { EmptyState } from "@/components/ui/EmptyState"

interface ReturnItem {
  id: string
  orderItemId: string
  quantity: number
  reason: string | null
  orderItem: { product: { title: string; thumbnail: string | null } } | null
}

interface ReturnRequest {
  id: string
  orderId: string
  order: { orderNumber: string }
  status: string
  type: string
  reason: string
  notes: string | null
  adminRemarks: string | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
  items: ReturnItem[]
  rmaTicket?: {
    ticketNumber: string
    status: string
    priority: string
    openedAt: string
    closedAt: string | null
    resolutionTimeMinutes: number | null
    activities?: { id: string; toStatus: string; note: string | null; createdAt: string }[]
  } | null
}

export default function ReturnsPage() {
  const router = useRouter()
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequestId, setSelectedRequestId] = useState("")

  useEffect(() => {
    setSelectedRequestId(new URLSearchParams(window.location.search).get("request") || "")
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/returns", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setReturns(data.returns || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (!loading && selectedRequestId) {
      document.getElementById(`request-${selectedRequestId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [loading, selectedRequestId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return { icon: <CheckCircle size={14} />, bg: "bg-green-100 text-green-700" }
      case "APPROVED": return { icon: <CheckCircle size={14} />, bg: "bg-blue-100 text-blue-700" }
      case "PROCESSING": return { icon: <Clock size={14} />, bg: "bg-yellow-100 text-yellow-700" }
      case "REJECTED": return { icon: <XCircle size={14} />, bg: "bg-red-100 text-red-700" }
      default: return { icon: <AlertCircle size={14} />, bg: "bg-gray-100 text-gray-700" }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  if (returns.length === 0) return (
    <div className="min-h-screen bg-gray-50">
      <EmptyState
        icon={RotateCcw}
        title="No return requests"
        description="You can request a return from any delivered order."
        action={{ label: "View Orders", href: "/orders" }}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Returns</h1>
            <p className="text-sm text-gray-500 mt-1">{returns.length} return request{returns.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/orders" className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
            <ArrowLeft size={16} /> Back to Orders
          </Link>
        </div>

        <div className="space-y-4">
          {returns.map((ret) => {
            const badge = getStatusBadge(ret.status)
            return (
              <div id={`request-${ret.id}`} key={ret.id} className={`card-base-static p-5 scroll-mt-24 ${selectedRequestId === ret.id ? "ring-2 ring-primary-500" : ""}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      {ret.type === "REPLACEMENT" ? "Replacement" : "Return"} for Order #{ret.order.orderNumber.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(ret.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
                    {badge.icon} {ret.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3"><span className="font-medium">Reason:</span> {ret.reason}</p>
                {ret.notes && <p className="text-xs text-gray-500 mb-3">{ret.notes}</p>}
                {ret.adminRemarks && (
                  <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-0.5">Note from our team:</p>
                    <p className="text-sm text-blue-800">{ret.adminRemarks}</p>
                  </div>
                )}
                {ret.rmaTicket && (
                  <div className="mb-3 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="text-xs font-medium text-primary-700">RMA Ticket {ret.rmaTicket.ticketNumber}</p><p className="text-xs text-gray-500">Opened {new Date(ret.rmaTicket.openedAt).toLocaleString("en-IN")}</p></div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary-700">{ret.rmaTicket.status.replace(/_/g, " ")}</span>
                    </div>
                    {ret.rmaTicket.activities?.length ? <div className="mt-2 border-t border-primary-100 pt-2"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Latest ticket activity</p>{ret.rmaTicket.activities.slice(0, 3).map((activity) => <div key={activity.id} className="text-xs text-gray-600"><span className="font-medium">{activity.toStatus.replace(/_/g, " ")}</span> · {new Date(activity.createdAt).toLocaleString("en-IN")}{activity.note && <span className="block text-gray-500">{activity.note}</span>}</div>)}</div> : null}
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Items:</p>
                  <div className="space-y-2">
                    {ret.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden shrink-0">
                          {item.orderItem?.product.thumbnail ? (
                            <img src={item.orderItem.product.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{item.orderItem?.product.title || "Item no longer available"}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}{item.reason ? ` - ${item.reason}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {ret.refundAmount && (
                  <div className="mt-3 px-3 py-2 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-700">Refund: {formatPrice(Number(ret.refundAmount))}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
