"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShoppingBag, ArrowLeft } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Header from "@/components/layout/Header"

interface Order {
  id: string; orderNumber: string; status: string; totalAmount: number; currency: string;
  createdAt: string; items: { id: string; quantity: number; totalPrice: number; product: { title: string; thumbnail: string | null } }[]
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setOrders(data.orders || []); setLoading(false) })
  }, [router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED": return "bg-green-100 text-green-700"
      case "SHIPPED": return "bg-blue-100 text-blue-700"
      case "PROCESSING": return "bg-yellow-100 text-yellow-700"
      case "CANCELLED": return "bg-red-100 text-red-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <Link href="/products" className="text-primary-600 hover:underline">Continue Shopping</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-12 text-center">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h2>
            <p className="text-gray-600 mb-4">Start shopping to place your first order.</p>
            <Link href="/products" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Browse Products</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Order #{order.orderNumber}</p>
                      <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">{order.items.length} item(s)</p>
                    </div>
                    <span className="font-bold text-primary-700">{formatPrice(Number(order.totalAmount))}</span>
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
