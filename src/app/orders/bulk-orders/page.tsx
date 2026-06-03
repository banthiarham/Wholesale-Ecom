"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, FileText } from "lucide-react"

interface BulkOrderItem {
  id: string
  product: { id: string; title: string; thumbnail: string | null; sku: string | null }
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface BulkOrder {
  id: string
  bulkOrderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  items: BulkOrderItem[]
  order?: { id: string; orderNumber: string; status: string } | null
}

export default function BulkOrdersPage() {
  const router = useRouter()
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    fetch("/api/bulk-orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setBulkOrders(data.bulkOrders || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT": return "bg-yellow-100 text-yellow-700"
      case "PLACED": return "bg-green-100 text-green-700"
      case "CANCELLED": return "bg-red-100 text-red-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "DRAFT": return "Draft"
      case "PLACED": return "Placed"
      case "CANCELLED": return "Cancelled"
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-2"><ArrowLeft size={16} /> Back to Orders</Link>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Orders</h1>
            <p className="text-sm text-gray-500 mt-1">Review and manage your bulk order drafts</p>
          </div>
          <Link href="/orders/bulk-upload" className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition">
            <Plus size={16} /> New Bulk Order
          </Link>
        </div>

        {bulkOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bulk orders yet</h3>
            <p className="text-gray-500 mb-4">Upload an Excel file to create your first bulk order draft.</p>
            <Link href="/orders/bulk-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition">
              <Plus size={16} /> Create Bulk Order
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bulkOrders.map((bo) => (
              <Link key={bo.id} href={`/orders/bulk-orders/${bo.id}`} className="block bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition group">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900">{bo.bulkOrderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(bo.status)}`}>
                        {getStatusLabel(bo.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{bo.items.length} item{bo.items.length !== 1 ? "s" : ""}</span>
                      <span>•</span>
                      <span>{new Date(bo.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">₹{Number(bo.totalAmount).toLocaleString("en-IN")}</p>
                    {bo.status === "PLACED" && bo.order && (
                      <p className="text-xs text-primary-600 mt-1 group-hover:underline">View Order →</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}