"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  currency: string
  createdAt: string
  updatedAt: string
  shippingAddress: any
  billingAddress: any
  notes?: string
  items: {
    id: string
    quantity: number
    unitPrice: number
    totalPrice: number
    product: { id: string; title: string; thumbnail: string | null; sku: string | null }
  }[]
  payment: { provider: string; status: string; amount: number; providerRef: string | null } | null
  user: { firstName: string; lastName: string; email: string; phone: string | null }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [paymentAlert, setPaymentAlert] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    fetch(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setOrder(data.order || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params.id, router])

  // Show payment status alert from CCAvenue callback
  useEffect(() => {
    const payment = searchParams.get("payment")
    if (payment === "success") setPaymentAlert("Payment successful! Your order is confirmed.")
    if (payment === "failure") setPaymentAlert("Payment failed. Please try again or choose COD.")
    if (payment === "aborted") setPaymentAlert("Payment was cancelled. You can retry from this page.")
    if (payment === "error") setPaymentAlert("Something went wrong with the payment. Contact support if amount was deducted.")
  }, [searchParams])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED": return "bg-green-100 text-green-700"
      case "SHIPPED": return "bg-blue-100 text-blue-700"
      case "PROCESSING": return "bg-yellow-100 text-yellow-700"
      case "CONFIRMED": return "bg-indigo-100 text-indigo-700"
      case "CANCELLED": return "bg-red-100 text-red-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DELIVERED": return <Package size={18} />
      case "SHIPPED": return <Truck size={18} />
      default: return <Package size={18} />
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "CAPTURED":
      case "AUTHORIZED":
        return <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={14} /> Paid</span>
      case "FAILED":
        return <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium"><XCircle size={14} /> Failed</span>
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1 text-gray-500 text-sm font-medium"><XCircle size={14} /> Cancelled</span>
      case "PENDING":
      default:
        return <span className="inline-flex items-center gap-1 text-yellow-600 text-sm font-medium"><AlertCircle size={14} /> Pending</span>
    }
  }

  const cancelOrder = async () => {
    if (!order || !confirm("Are you sure you want to cancel this order?")) return
    const token = localStorage.getItem("token")
    if (!token) return

    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      } else {
        alert("Failed to cancel order")
      }
    } catch {
      alert("Something went wrong")
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Order not found</h1>
          <Link href="/orders" className="text-primary-600 hover:underline">Back to orders</Link>
        </main>
      </div>
    )
  }

  const canCancel = !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6">
          <ArrowLeft size={16} /> Back to orders
        </Link>

        {paymentAlert && (
          <div className={`mb-6 p-4 rounded-lg border ${paymentAlert.includes("successful") ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <p className="font-medium">{paymentAlert}</p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status)} {order.status}
              </span>
              {canCancel && (
                <button
                  onClick={cancelOrder}
                  disabled={cancelling}
                  className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel"}
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="font-semibold text-gray-900 mb-4">Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.product.thumbnail ? (
                      <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product.title}</p>
                    {item.product.sku && <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>}
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatPrice(Number(item.totalPrice))}</p>
                    <p className="text-xs text-gray-500">{formatPrice(Number(item.unitPrice))} each</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Shipping Address</h2>
            </div>
            {order.shippingAddress ? (
              <div className="text-sm text-gray-700 space-y-1">
                <p>{order.shippingAddress.street}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No shipping address provided</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Payment</h2>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between">
                <span>Method</span>
                <span className="font-medium">{order.payment?.provider || "COD"}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                {getPaymentStatusBadge(order.payment?.status || "PENDING")}
              </div>
              {order.payment?.providerRef && (
                <div className="flex justify-between">
                  <span>Transaction ID</span>
                  <span className="font-medium text-xs">{order.payment.providerRef}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-primary-700">{formatPrice(Number(order.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
