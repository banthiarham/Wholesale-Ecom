"use client"

import React, { useEffect, useState } from "react"
import { Search, FileText, ChevronDown, ChevronUp, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"

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
  DRAFT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  PLACED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
    return <SkeletonTable />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bulk Orders</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Drafts</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{draftCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Placed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{placedCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Cancelled</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{cancelledCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatPrice(totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by bulk order #, buyer name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PLACED">Placed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <FileText size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No bulk orders found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Bulk Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Buyer</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((bo) => (
                  <React.Fragment key={bo.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{bo.bulkOrderNumber}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-gray-900 dark:text-gray-100">{bo.user?.firstName} {bo.user?.lastName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{bo.user?.email}</p>
                          {bo.user?.companyName && <p className="text-xs text-gray-400 dark:text-gray-500">{bo.user.companyName}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{bo.items.length}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatPrice(Number(bo.totalAmount))}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bo.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                          {STATUS_LABELS[bo.status] || bo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {bo.order ? (
                          <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                            #{bo.order.orderNumber.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(bo.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpand(bo.id)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition">
                          {expandedId === bo.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>

                    {expandedId === bo.id && (
                      <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Items</h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Product</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">SKU</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Unit Price</th>
                                  <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Qty</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {bo.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                                      <div className="flex items-center gap-2">
                                        {item.product.thumbnail ? (
                                          <img src={item.product.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                          <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                            <Package size={12} className="text-gray-400 dark:text-gray-500" />
                                          </div>
                                        )}
                                        {item.product.title}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{item.sku || item.product.sku || "—"}</td>
                                    <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{formatPrice(Number(item.unitPrice))}</td>
                                    <td className="px-3 py-2 text-center text-gray-900 dark:text-gray-100">{item.quantity}</td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(item.totalPrice))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {bo.notes && (
                              <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-medium">Notes:</span> {bo.notes}</p>
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