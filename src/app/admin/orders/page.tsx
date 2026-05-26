"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, ChevronDown, ChevronUp, Eye, Truck, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  paymentStatus: string
  createdAt: string
  user: { firstName: string; lastName: string; email: string } | null
  items: { product: { title: string }; quantity: number; unitPrice: number }[]
}

const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filtered, setFiltered] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sortKey, setSortKey] = useState<keyof Order>("createdAt")
  const [sortDesc, setSortDesc] = useState(true)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState("")
  const [carrier, setCarrier] = useState("")
  const [trackingLoading, setTrackingLoading] = useState(false)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadOrders()
  }, [token])

  useEffect(() => {
    let result = [...orders]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.user?.email?.toLowerCase().includes(q) ||
          o.user?.firstName?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter)
    }
    result.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string
      const bv = (b[sortKey] ?? "") as string
      return sortDesc ? (bv > av ? 1 : -1) : av > bv ? 1 : -1
    })
    setFiltered(result)
  }, [orders, search, statusFilter, sortKey, sortDesc])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
      if (detailOrder?.id === id) setDetailOrder((prev) => (prev ? { ...prev, status } : null))
    } catch (err) {
      console.error(err)
      alert("Failed to update status")
    }
  }

  const cancelOrder = async (id: string) => {
    if (!confirm("Cancel this order?")) return
    try {
      await fetch(`/api/orders/${id}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "CANCELLED" } : o)))
      if (detailOrder?.id === id) setDetailOrder((prev) => (prev ? { ...prev, status: "CANCELLED" } : null))
    } catch (err) {
      console.error(err)
      alert("Failed to cancel order")
    }
  }

  const updateTracking = async () => {
    if (!detailOrder) return
    setTrackingLoading(true)
    try {
      await fetch(`/api/orders/${detailOrder.id}/tracking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trackingNumber: trackingNumber || undefined, carrier: carrier || undefined }),
      })
      setShowTracking(false)
      setTrackingNumber("")
      setCarrier("")
    } catch (err) {
      console.error(err)
      alert("Failed to update tracking")
    } finally {
      setTrackingLoading(false)
    }
  }

  const SortIcon = ({ col }: { col: keyof Order }) => {
    if (sortKey !== col) return <ChevronDown size={14} className="text-gray-300" />
    return sortDesc ? <ChevronDown size={14} className="text-primary-600" /> : <ChevronUp size={14} className="text-primary-600" />
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-50 text-yellow-700",
      PROCESSING: "bg-blue-50 text-blue-700",
      SHIPPED: "bg-purple-50 text-purple-700",
      DELIVERED: "bg-green-50 text-green-700",
      CANCELLED: "bg-gray-100 text-gray-600",
    }
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${colors[status] || "bg-gray-100 text-gray-600"}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    { key: "orderNumber" as const, label: "Order" },
                    { key: "status" as const, label: "Status" },
                    { key: "total" as const, label: "Total" },
                    { key: "paymentStatus" as const, label: "Payment" },
                    { key: "createdAt" as const, label: "Date" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => {
                        if (sortKey === col.key) setSortDesc(!sortDesc)
                        else { setSortKey(col.key); setSortDesc(true) }
                      }}
                    >
                      <div className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      #{o.orderNumber}
                      <p className="text-xs text-gray-500 font-normal">{o.user ? `${o.user.firstName} ${o.user.lastName}` : "Guest"}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(o.status)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(Number(o.total))}</td>
                    <td className="px-4 py-3 text-gray-600 uppercase text-xs">{o.paymentStatus}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setDetailOrder(o)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50" title="View"><Eye size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Order #{detailOrder.orderNumber}</h3>
                <p className="text-sm text-gray-500">{new Date(detailOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                {statusBadge(detailOrder.status)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Customer</span>
                <span className="text-sm font-medium text-gray-900">
                  {detailOrder.user ? `${detailOrder.user.firstName} ${detailOrder.user.lastName} (${detailOrder.user.email})` : "Guest"}
                </span>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Items</h4>
                <div className="space-y-2">
                  {detailOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.product.title} × {item.quantity}</span>
                      <span className="font-medium">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-bold text-primary-700">{formatPrice(Number(detailOrder.total))}</span>
              </div>

                  {detailOrder.status !== "CANCELLED" && detailOrder.status !== "DELIVERED" && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-gray-700">Update Status:</p>
                  <div className="flex flex-wrap gap-2">
                    {statuses.filter((s) => s !== detailOrder.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(detailOrder.id, s)}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition"
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => cancelOrder(detailOrder.id)}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              )}

              {/* Update Tracking */}
              {detailOrder.status !== "CANCELLED" && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setShowTracking(!showTracking)} className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition">
                    <Truck size={16} /> Update Tracking
                  </button>
                  {showTracking && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking Number" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier (e.g. FedEx, DHL)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <button onClick={updateTracking} disabled={trackingLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{trackingLoading ? "Updating..." : "Save Tracking"}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
