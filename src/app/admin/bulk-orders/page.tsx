"use client"

import { useState, useEffect } from "react"
import { Search, ShoppingBag, Eye, ChevronRight, AlertCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface BulkOrderItem {
  id: string
  productId: string
  sku?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product?: { id: string; title: string; thumbnail?: string; sku?: string }
}

interface BulkOrder {
  id: string
  bulkOrderNumber: string
  status: string
  shippingAddress: any
  notes?: string
  totalAmount: number
  orderId?: string
  createdAt: string
  updatedAt: string
  items: BulkOrderItem[]
  user: { id: string; firstName: string; lastName: string; email: string }
  order?: any
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  PLACED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PLACED", "CANCELLED"],
  PLACED: ["CANCELLED"],
  CANCELLED: [],
}

export default function AdminBulkOrdersPage() {
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<BulkOrder | null>(null)
  const [newStatus, setNewStatus] = useState("")
  const [statusChanging, setStatusChanging] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    if (token) loadBulkOrders()
  }, [token, statusFilter])

  const loadBulkOrders = async () => {
    setLoading(true)
    try {
      const url = statusFilter ? `/api/bulk-orders?status=${statusFilter}` : "/api/bulk-orders"
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setBulkOrders(data.bulkOrders || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadBulkOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/bulk-orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSelectedOrder(data.bulkOrder)
      setNewStatus("")
      setError("")
    } catch (e) {
      console.error(e)
    }
  }

  const handleStatusChange = async () => {
    if (!selectedOrder || !newStatus) return
    setStatusChanging(true)
    setError("")
    try {
      const res = await fetch(`/api/bulk-orders/${selectedOrder.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to update status")
      }
      await loadBulkOrder(selectedOrder.id)
      await loadBulkOrders()
      setNewStatus("")
    } catch (e: any) {
      setError(e.message || "Failed to update status")
    } finally {
      setStatusChanging(false)
    }
  }

  const handleConvertToOrder = async () => {
    if (!selectedOrder) return
    setConverting(true)
    setError("")
    try {
      const res = await fetch(`/api/bulk-orders/${selectedOrder.id}/convert`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to convert to order")
      }
      await loadBulkOrder(selectedOrder.id)
      await loadBulkOrders()
    } catch (e: any) {
      setError(e.message || "Failed to convert to order")
    } finally {
      setConverting(false)
    }
  }

  const filtered = bulkOrders.filter((o) => {
    const q = search.toLowerCase()
    const matchSearch =
      o.bulkOrderNumber.toLowerCase().includes(q) ||
      `${o.user.firstName} ${o.user.lastName}`.toLowerCase().includes(q) ||
      o.user.email.toLowerCase().includes(q)
    const matchStatus = !statusFilter || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    total: bulkOrders.length,
    DRAFT: bulkOrders.filter((o) => o.status === "DRAFT").length,
    PLACED: bulkOrders.filter((o) => o.status === "PLACED").length,
    CANCELLED: bulkOrders.filter((o) => o.status === "CANCELLED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Bulk Orders</h1>
        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
          {counts.total} orders
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", count: counts.total, color: "text-gray-900" },
          { label: "Draft", count: counts.DRAFT, color: "text-yellow-700" },
          { label: "Placed", count: counts.PLACED, color: "text-green-700" },
          { label: "Cancelled", count: counts.CANCELLED, color: "text-red-700" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.count}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order #, customer name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PLACED">Placed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No bulk orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Items</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{order.bulkOrderNumber}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.user.firstName} {order.user.lastName}
                      <div className="text-xs text-gray-400">{order.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{order.items.length} items</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{formatPrice(order.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => loadBulkOrder(order.id)}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedOrder.bulkOrderNumber}
              </h2>
              <button
                onClick={() => { setSelectedOrder(null); setError("") }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>

            {/* Status */}
            <div className="mb-4">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[selectedOrder.status] || "bg-gray-100 text-gray-700"}`}>
                {selectedOrder.status}
              </span>
              {selectedOrder.orderId && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                  Linked Order
                </span>
              )}
            </div>

            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900">
                {selectedOrder.user.firstName} {selectedOrder.user.lastName}
              </p>
              <p className="text-sm text-gray-500">{selectedOrder.user.email}</p>
            </div>

            {/* Shipping Address */}
            {selectedOrder.shippingAddress && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Shipping Address</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {typeof selectedOrder.shippingAddress === "string"
                    ? selectedOrder.shippingAddress
                    : Object.entries(selectedOrder.shippingAddress)
                        .filter(([, v]) => v)
                        .map(([, v]) => v)
                        .join(", ")}
                </p>
              </div>
            )}

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Notes</h3>
                <p className="text-sm text-gray-600">{selectedOrder.notes}</p>
              </div>
            )}

            {/* Items */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Items ({selectedOrder.items.length})</h3>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.product?.title || "Product"}</p>
                      {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {item.quantity} &times; {formatPrice(item.unitPrice)}
                      </p>
                      <p className="text-sm font-medium text-gray-900">{formatPrice(item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-4">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-lg font-bold text-gray-900">{formatPrice(selectedOrder.totalAmount)}</span>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-2.5">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Status Change */}
            {VALID_TRANSITIONS[selectedOrder.status]?.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Change Status</h3>
                <div className="flex gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">Select new status</option>
                    {VALID_TRANSITIONS[selectedOrder.status]?.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleStatusChange}
                    disabled={!newStatus || statusChanging}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {statusChanging ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            )}

            {/* Convert to Order */}
            {selectedOrder.status === "DRAFT" && !selectedOrder.orderId && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <button
                  onClick={handleConvertToOrder}
                  disabled={converting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                  {converting ? "Converting..." : "Convert to Order"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}