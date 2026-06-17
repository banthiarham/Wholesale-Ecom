"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RotateCcw, Package, ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"
import Image from "next/image"
import { formatPrice } from "@/lib/utils"

interface ReturnItem {
  id: string
  orderItemId: string
  quantity: number
  reason: string | null
  orderItem: { product: { title: string; thumbnail: string | null } }
}

interface ReturnRequest {
  id: string
  orderId: string
  order: { orderNumber: string }
  status: string
  reason: string
  notes: string | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
  items: ReturnItem[]
}

export default function ReturnsPage() {
  const router = useRouter()
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/returns", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setReturns(data.returns || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center max-w-md">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <RotateCcw size={36} className="text-orange-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">No return requests</h1>
        <p className="text-sm text-gray-500 mb-6">You can request a return from any delivered order.</p>
        <Link href="/orders" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
          View Orders
        </Link>
      </div>
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
              <div key={ret.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Return for Order #{ret.order.orderNumber.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{new Date(ret.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
                    {badge.icon} {ret.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3"><span className="font-medium">Reason:</span> {ret.reason}</p>
                {ret.notes && <p className="text-xs text-gray-500 mb-3">{ret.notes}</p>}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Items:</p>
                  <div className="space-y-2">
                    {ret.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden shrink-0 relative">
                          {item.orderItem.product.thumbnail ? (
                            <Image src={item.orderItem.product.thumbnail} alt="" fill className="object-cover" sizes="40px" />
                          ) : (
                            <Package size={16} className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{item.orderItem.product.title}</p>
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