"use client"

import React, { useEffect, useState } from "react"
import { Search, FileText, ChevronDown, ChevronUp, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface BulkOrderItem {
  id: string
  sku: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  product: { id: string; title: string; thumbnail: string | null; sku: string | null }
}

interface BulkOrder {
  id: string
  bulkOrderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  notes: string | null
  items: BulkOrderItem[]
  user: { id: string; firstName: string; lastName: string; email: string; companyName: string | null }
  order?: { id: string; orderNumber: string; status: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  PLACED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PLACED: "Placed",
  CANCELLED: "Cancelled",
}

export default function AdminBulkOrdersPage() {
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return
    setLoading(true)
    fetch("/api/bulk-orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setBulkOrders(data.bulkOrders || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = bulkOrders.filter((bo) => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      bo.bulkOrderNumber.toLowerCase().includes(q) ||
      bo.user?.email?.toLowerCase().includes(q) ||
      `${bo.user?.firstName || ""} ${bo.user?.lastName || ""}`.toLowerCase().includes(q)
    const matchStatus = !statusFilter || bo.status === statusFilter
    return matchSearch && matchStatus
  })

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const draftCount = bulkOrders.filter((bo) => bo.status === "DRAFT").length
  const placedCount = bulkOrders.filter((bo) => bo.status === "PLACED").length
  const cancelledCount = bulkOrders.filter((bo) => bo.status === "CANCELLED").length
  const totalRevenue = bulkOrders.filter((bo) => bo.status === "PLACED").reduce((sum, bo) => sum + Number(bo.totalAmount), 0)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Bulk Orders</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Drafts</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{draftCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Placed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{placedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Cancelled</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{cancelledCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by bulk order #, buyer name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PLACED">Placed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <FileText size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No bulk orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Bulk Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Buyer</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((bo) => (
                  <React.Fragment key={bo.id}>
                    <tr className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{bo.bulkOrderNumber}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-gray-900">{bo.user?.firstName} {bo.user?.lastName}</p>
                          <p className="text-xs text-gray-500">{bo.user?.email}</p>
                          {bo.user?.companyName && <p className="text-xs text-gray-400">{bo.user.companyName}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{bo.items.length}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrice(Number(bo.totalAmount))}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bo.status] || "bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[bo.status] || bo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {bo.order ? (
                          <span className="text-xs text-primary-600 font-medium">
                            #{bo.order.orderNumber.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(bo.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpand(bo.id)} className="p-1 text-gray-400 hover:text-gray-600 transition">
                          {expandedId === bo.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>

                    {expandedId === bo.id && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700">Items</h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="px-3 py-2 text-left font-medium text-gray-500">Product</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-500">SKU</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-500">Unit Price</th>
                                  <th className="px-3 py-2 text-center font-medium text-gray-500">Qty</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-500">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {bo.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2 text-gray-900">
                                      <div className="flex items-center gap-2">
                                        {item.product.thumbnail ? (
                                          <img src={item.product.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                                            <Package size={12} className="text-gray-400" />
                                          </div>
                                        )}
                                        {item.product.title}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500">{item.sku || item.product.sku || "—"}</td>
                                    <td className="px-3 py-2 text-right text-gray-900">{formatPrice(Number(item.unitPrice))}</td>
                                    <td className="px-3 py-2 text-center text-gray-900">{item.quantity}</td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">{formatPrice(Number(item.totalPrice))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {bo.notes && (
                              <p className="text-sm text-gray-500"><span className="font-medium">Notes:</span> {bo.notes}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}