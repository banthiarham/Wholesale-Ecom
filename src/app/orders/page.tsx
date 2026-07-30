"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ShoppingBag, RotateCcw, Eye, Truck, Download, XCircle, RefreshCcw,
  MapPin, CreditCard, Package, CheckCircle2, Clock, AlertCircle,
} from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { EmptyState } from "@/components/ui/EmptyState"

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  currency: string
  createdAt: string
  shippingAddress: { street?: string; city?: string; state?: string; zip?: string; country?: string } | null
  payment: { provider: string; status: string } | null
  items: { id: string; productId: string; quantity: number; totalPrice: number; product: { title: string; thumbnail: string | null } }[]
}

const STATUS_FILTERS = ["All", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge bg-gray-100 text-gray-700",
  CONFIRMED: "badge-primary",
  PROCESSING: "badge-warning",
  SHIPPED: "badge-primary",
  DELIVERED: "badge-success",
  CANCELLED: "badge-danger",
  REFUNDED: "badge bg-gray-100 text-gray-700",
}

const PAYMENT_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  CAPTURED: { label: "Paid", className: "text-green-600", icon: CheckCircle2 },
  AUTHORIZED: { label: "Paid", className: "text-green-600", icon: CheckCircle2 },
  FAILED: { label: "Payment Failed", className: "text-red-500", icon: XCircle },
  CANCELLED: { label: "Payment Cancelled", className: "text-gray-500", icon: XCircle },
  PENDING: { label: "Payment Pending", className: "text-amber-600", icon: Clock },
}

const POLL_INTERVAL_MS = 20000

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("All")
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback((silent = false) => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    if (!silent) setLoading(true)
    fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    load()
    // Poll quietly so admin-driven status changes show up without a manual refresh.
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

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

  const handleCancel = async (e: React.MouseEvent, order: Order) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Cancel order #${order.orderNumber.slice(0, 8)}?`)) return
    setCancellingId(order.id)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)))
        showToast("success", "Order cancelled")
      } else {
        showToast("error", "Failed to cancel order")
      }
    } catch {
      showToast("error", "Something went wrong")
    } finally {
      setCancellingId(null)
    }
  }

  const visibleOrders = statusFilter === "All" ? orders : orders.filter((o) => o.status === statusFilter)

  return (
    <div className="min-h-screen bg-gray-50/60">
      <main className="section-container py-8 lg:py-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="eyebrow">Account</span>
            <h1 className="heading-xl">My Orders</h1>
          </div>
          <Link href="/products" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-all duration-200">
            Continue Shopping
          </Link>
        </div>

        {/* Status filter chips */}
        {orders.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-6 mb-6 scrollbar-hide">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 ${
                  statusFilter === s
                    ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600"
                }`}
              >
                {s === "All" ? "All Orders" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Start shopping to place your first order."
            action={{ label: "Browse Products", href: "/products" }}
          />
        ) : visibleOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">No {statusFilter.toLowerCase()} orders.</div>
        ) : (
          <div className="space-y-4">
            {visibleOrders.map((order) => {
              const canCancel = !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)
              const canReturn = order.status === "DELIVERED"
              const canReorder = order.status !== "CANCELLED"
              const paymentInfo = PAYMENT_BADGE[order.payment?.status || "PENDING"]
              const PaymentIcon = paymentInfo.icon
              const addressPreview = order.shippingAddress
                ? [order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")
                : null

              return (
                <div key={order.id} className="card-base p-5 sm:p-6">
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Package size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Order #{order.orderNumber.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${STATUS_BADGE[order.status] || "bg-gray-100 text-gray-700"}`}>{order.status}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${paymentInfo.className}`}>
                        <PaymentIcon size={13} /> {paymentInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <InfoCell icon={Package} label="Items" value={`${order.items.length} item${order.items.length !== 1 ? "s" : ""}`} />
                    <InfoCell icon={CreditCard} label="Payment Method" value={order.payment?.provider || "COD"} />
                    <InfoCell icon={MapPin} label="Delivery Address" value={addressPreview || "—"} />
                    <InfoCell icon={AlertCircle} label="Amount" value={formatPrice(Number(order.totalAmount))} bold />
                  </div>

                  {/* Item thumbnails preview */}
                  <div className="flex items-center gap-2 mb-5">
                    {order.items.slice(0, 4).map((item) => (
                      <div key={item.id} className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                        {item.product.thumbnail ? (
                          <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                        )}
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors">
                      <Eye size={14} /> View Order
                    </Link>
                    <Link href={`/orders/${order.id}#tracking`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                      <Truck size={14} /> Track Order
                    </Link>
                    <Link href={`/orders/${order.id}/invoice`} target="_blank" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                      <Download size={14} /> Download Invoice
                    </Link>
                    {canReorder && (
                      <button onClick={(e) => handleReorder(e, order)} disabled={reorderingId === order.id} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                        <RotateCcw size={14} /> {reorderingId === order.id ? "Adding..." : "Reorder"}
                      </button>
                    )}
                    {canReturn && (
                      <Link href={`/orders/${order.id}?action=return`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                        <RefreshCcw size={14} /> Return / Replace
                      </Link>
                    )}
                    {canCancel && (
                      <button onClick={(e) => handleCancel(e, order)} disabled={cancellingId === order.id} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <XCircle size={14} /> {cancellingId === order.id ? "Cancelling..." : "Cancel Order"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function InfoCell({ icon: Icon, label, value, bold }: { icon: any; label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        <Icon size={11} /> {label}
      </p>
      <p className={`text-sm truncate ${bold ? "font-bold text-primary-700" : "font-medium text-gray-800"}`}>{value}</p>
    </div>
  )
}
