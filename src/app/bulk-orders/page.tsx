"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PackageOpen, Eye, ChevronRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface BulkOrderItem {
  id: string
  productId: string
  sku?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product?: { id: string; title: string; thumbnail?: string }
}

interface BulkOrder {
  id: string
  bulkOrderNumber: string
  status: string
  totalAmount: number
  orderId?: string
  createdAt: string
  items: BulkOrderItem[]
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  PLACED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

export default function BulkOrdersPage() {
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<BulkOrder | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    if (token) loadBulkOrders()
  }, [token])

  const loadBulkOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/bulk-orders/me", { headers: { Authorization: `Bearer ${token}` } })
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
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Orders</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : bulkOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <PackageOpen size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No bulk orders yet.</p>
          <Link href="/products" className="text-primary-600 hover:text-primary-700 font-medium">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bulkOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">{order.bulkOrderNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                    {order.status}
                  </span>
                  <span className="font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{order.items.length} items</p>
                <button
                  onClick={() => loadBulkOrder(order.id)}
                  className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  <Eye size={14} /> View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{selectedOrder.bulkOrderNumber}</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="mb-4">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[selectedOrder.status] || "bg-gray-100 text-gray-700"}`}>
                {selectedOrder.status}
              </span>
              {selectedOrder.orderId && (
                <Link href={`/orders/${selectedOrder.orderId}`} className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200">
                  View Order <ChevronRight size={10} />
                </Link>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.product?.title || "Product"}</p>
                    {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{item.quantity} &times; {formatPrice(item.unitPrice)}</p>
                    <p className="text-sm font-medium text-gray-900">{formatPrice(item.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-lg font-bold text-gray-900">{formatPrice(selectedOrder.totalAmount)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}