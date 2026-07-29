"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShoppingBag, RotateCcw, FileText } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { EmptyState } from "@/components/ui/EmptyState"

interface Order {
  id: string; orderNumber: string; status: string; totalAmount: number; currency: string;
  createdAt: string; items: { id: string; productId: string; quantity: number; totalPrice: number; product: { title: string; thumbnail: string | null } }[]
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setOrders(data.orders || []); setLoading(false) })
  }, [router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED": return "badge-success"
      case "SHIPPED": return "badge-primary"
      case "PROCESSING": return "badge-warning"
      case "CANCELLED": return "badge-danger"
      default: return "badge bg-gray-100 text-gray-700"
    }
  }

  const handleReorder = async (e: React.MouseEvent, order: Order) => {
    e.preventDefault()
    e.stopPropagation()
    setReorderingId(order.id)
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const results = await Promise.all(
        order.items.map((item) =>
          fetch("/api/cart", {
            method: "POST",
            headers,
            body: JSON.stringify({ productId: item.productId, quantity: item.quantity }),
          }).then((res) => res.ok)
        )
      )
      window.dispatchEvent(new CustomEvent("cart-updated"))
      const failedCount = results.filter((ok) => !ok).length
      if (failedCount === 0) {
        openCartDrawer()
      } else if (failedCount < results.length) {
        showToast("error", `${failedCount} item(s) could not be added — check stock/quantity limits`)
        openCartDrawer()
      } else {
        showToast("error", "Could not add items to cart")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setReorderingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="heading-lg">My Orders</h1>
          <div className="flex items-center gap-3">
            <Link href="/orders/bulk-upload" className="btn-sm flex items-center gap-2">
              <FileText size={16} /> Bulk Order
            </Link>
            <Link href="/products" className="text-primary-600 hover:text-primary-700 hover:underline text-sm font-medium transition-colors">Continue Shopping</Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Start shopping to place your first order."
            action={{ label: "Browse Products", href: "/products" }}
          />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <div className="card-base p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Order #{order.orderNumber}</p>
                      <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`badge ${getStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">{order.items.length} item(s)</p>
                    </div>
                    <span className="font-bold text-primary-700">{formatPrice(Number(order.totalAmount))}</span>
                  </div>
                  {order.status !== "CANCELLED" && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <button
                        onClick={(e) => handleReorder(e, order)}
                        disabled={reorderingId === order.id}
                        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw size={14} /> {reorderingId === order.id ? "Adding to cart..." : "Reorder"}
                      </button>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
