"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import Header from "@/components/layout/Header"

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  user: { firstName: string; lastName: string; email: string }
  items: { product: { title: string; sku: string | null }; quantity: number; unitPrice: number; totalPrice: number }[]
}

export default function VendorOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/vendor/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((d) => { setOrders(Array.isArray(d) ? d : []); setLoading(false) })
  }, [router])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-700", CONFIRMED: "bg-blue-100 text-blue-700", PROCESSING: "bg-purple-100 text-purple-700",
      SHIPPED: "bg-indigo-100 text-indigo-700", DELIVERED: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-700",
    }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${map[status] || "bg-gray-100"}`}>{status}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-4"><ArrowLeft size={16} /> Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders with My Products</h1>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No orders found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">Order #{order.orderNumber.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{order.user.firstName} {order.user.lastName} • {order.user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(order.status)}
                    <span className="font-medium">₹{Number(order.totalAmount).toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-gray-600">
                      <span>{item.product.title} x{item.quantity}</span>
                      <span>₹{Number(item.totalPrice).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
