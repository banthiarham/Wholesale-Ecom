"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Package, Truck, MapPin, CreditCard, Receipt, CheckCircle, XCircle, AlertCircle, RotateCcw, ShoppingCart, Navigation, ExternalLink, Circle, Clock } from "lucide-react"
import { formatPrice, getCartSessionId, formatAddress } from "@/lib/utils"

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
  trackingNumber?: string | null
  carrier?: string | null
  shippingEta?: string | null
  items: {
    id: string
    productId: string
    quantity: number
    unitPrice: number
    totalPrice: number
    product: { id: string; title: string; thumbnail: string | null; sku: string | null }
  }[]
  payment: { provider: string; status: string; amount: number; providerRef: string | null } | null
  user: { firstName: string; lastName: string; email: string; phone: string | null }
  deliveryPartner?: { id: string; name: string; code: string; trackingUrlTemplate: string | null; logo: string | null } | null
  deliveryTracking?: { status: string; currentLocation: string | null; estimatedDelivery: string | null; events: { status: string; location: string | null; notes: string | null; occurredAt: string }[] } | null
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [paymentAlert, setPaymentAlert] = useState<string | null>(null)
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [returnReason, setReturnReason] = useState("")
  const [returnNotes, setReturnNotes] = useState("")
  const [returnItems, setReturnItems] = useState<Record<string, { qty: number; selected: boolean }>>({})
  const [submittingReturn, setSubmittingReturn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    fetch(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        setOrder(data.order || null)
        setLoading(false)
        if (data.order) {
          const ri: Record<string, { qty: number; selected: boolean }> = {}
          data.order.items.forEach((item: any) => { ri[item.id] = { qty: item.quantity, selected: false } })
          setReturnItems(ri)
        }
      })
      .catch(() => setLoading(false))
  }, [params.id, router])

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
      case "REFUNDED": return "bg-purple-100 text-purple-700"
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
      case "CAPTURED": case "AUTHORIZED": return <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={14} /> Paid</span>
      case "FAILED": return <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium"><XCircle size={14} /> Failed</span>
      case "CANCELLED": return <span className="inline-flex items-center gap-1 text-gray-500 text-sm font-medium"><XCircle size={14} /> Cancelled</span>
      default: return <span className="inline-flex items-center gap-1 text-yellow-600 text-sm font-medium"><AlertCircle size={14} /> Pending</span>
    }
  }

  const cancelOrder = async () => {
    if (!order || !confirm("Are you sure you want to cancel this order?")) return
    const token = localStorage.getItem("token")
    if (!token) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { const data = await res.json(); setOrder(data.order) } else { alert("Failed to cancel order") }
    } catch { alert("Something went wrong") } finally { setCancelling(false) }
  }

  const handleReorder = async () => {
    if (!order) return
    setReordering(true)
    try {
      for (const item of order.items) {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
          body: JSON.stringify({ productId: item.productId, quantity: item.quantity }),
        })
      }
      window.dispatchEvent(new CustomEvent("cart-updated"))
      router.push("/cart")
    } catch (err) { console.error(err) } finally { setReordering(false) }
  }

  const handleReturnSubmit = async () => {
    if (!order) return
    const token = localStorage.getItem("token")
    if (!token) return
    const selectedItems = Object.entries(returnItems).filter(([, v]) => v.selected).map(([id, v]) => ({ orderItemId: id, quantity: v.qty }))
    if (selectedItems.length === 0) { alert("Select at least one item to return"); return }
    if (!returnReason.trim()) { alert("Please provide a reason"); return }

    setSubmittingReturn(true)
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, reason: returnReason, notes: returnNotes, items: selectedItems }),
      })
      if (res.ok) { setShowReturnForm(false); alert("Return request submitted!") }
      else { const data = await res.json(); alert(data.message || "Failed to submit return") }
    } catch (err) { console.error(err) } finally { setSubmittingReturn(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div></div>
  if (!order) return <div className="min-h-screen bg-gray-50"><main className="max-w-4xl mx-auto px-4 py-12 text-center"><h1 className="text-2xl font-bold text-gray-900 mb-4">Order not found</h1><Link href="/orders" className="text-primary-600 hover:underline">Back to orders</Link></main></div>

  const canCancel = !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)
  const canReturn = order.status === "DELIVERED"
  const canReorder = !["CANCELLED"].includes(order.status)

  const statusSteps = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]
  const currentStepIdx = statusSteps.indexOf(order.status)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to orders</Link>

        {paymentAlert && (
          <div className={`mb-6 p-4 rounded-lg border ${paymentAlert.includes("successful") ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <p className="font-medium">{paymentAlert}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status)} {order.status}
              </span>
              {canCancel && <button onClick={cancelOrder} disabled={cancelling} className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50">{cancelling ? "Cancelling..." : "Cancel"}</button>}
            </div>
          </div>

          {/* Order Status Timeline */}
          {currentStepIdx >= 0 && (
            <div className="flex items-center justify-between mb-6 px-2">
              {statusSteps.map((step, idx) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx <= currentStepIdx ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {idx <= currentStepIdx ? <CheckCircle size={16} /> : idx + 1}
                    </div>
                    <span className={`text-xs mt-1 ${idx <= currentStepIdx ? "text-primary-600 font-medium" : "text-gray-400"}`}>{step}</span>
                  </div>
                  {idx < statusSteps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${idx < currentStepIdx ? "bg-primary-600" : "bg-gray-200"}`} style={{ minWidth: "40px" }} />}
                </div>
              ))}
            </div>
          )}

          {/* Tracking Info */}
          {(order.trackingNumber || order.carrier || order.shippingEta || order.deliveryPartner || order.deliveryTracking) && (
            <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Navigation size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Shipment Tracking</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {(order.deliveryPartner?.name || order.carrier) && <div><span className="text-blue-600">Carrier:</span> <span className="font-medium text-blue-900">{order.deliveryPartner?.name || order.carrier}</span></div>}
                {order.trackingNumber && <div><span className="text-blue-600">Tracking #:</span> <span className="font-mono font-medium text-blue-900">{order.trackingNumber}</span></div>}
                {(order.deliveryTracking?.estimatedDelivery || order.shippingEta) && <div><span className="text-blue-600">Est. Delivery:</span> <span className="font-medium text-blue-900">{new Date(order.deliveryTracking?.estimatedDelivery || order.shippingEta!).toLocaleDateString()}</span></div>}
              </div>
              {order.deliveryPartner?.trackingUrlTemplate && order.trackingNumber && (
                <a
                  href={order.deliveryPartner.trackingUrlTemplate.replace("{trackingNumber}", order.trackingNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                >
                  <ExternalLink size={12} /> Track on {order.deliveryPartner.name}
                </a>
              )}
              {order.deliveryTracking?.currentLocation && (
                <div className="mt-2 text-xs text-blue-600 flex items-center gap-1"><MapPin size={12} /> {order.deliveryTracking.currentLocation}</div>
              )}
              {order.deliveryTracking?.events && order.deliveryTracking.events.length > 0 && (
                <div className="mt-4 space-y-0">
                  {order.deliveryTracking.events.slice().reverse().map((event, i) => {
                    const labels: Record<string, string> = {
                      PENDING: "Pending", PICKED_UP: "Picked Up", IN_TRANSIT: "In Transit",
                      OUT_FOR_DELIVERY: "Out for Delivery", DELIVERED: "Delivered",
                      FAILED: "Failed", RETURNED: "Returned",
                    }
                    const isLatest = i === 0
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <Circle size={14} className={isLatest ? "text-blue-600 fill-blue-600" : "text-gray-300"} />
                          {i < order.deliveryTracking!.events.length - 1 && <div className="w-0.5 h-6 bg-gray-200" />}
                        </div>
                        <div className="pb-3">
                          <p className={`text-xs font-medium ${isLatest ? "text-blue-900" : "text-gray-500"}`}>{labels[event.status] || event.status}</p>
                          {event.location && <p className="text-xs text-gray-400">{event.location}</p>}
                          {event.notes && <p className="text-xs text-gray-400">{event.notes}</p>}
                          <p className="text-xs text-gray-400">{new Date(event.occurredAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-6">
            <h2 className="font-semibold text-gray-900 mb-4">Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.product.thumbnail ? <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-cover" /> : <Package size={24} className="text-gray-400" />}
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-100">
            {canReorder && (
              <button onClick={handleReorder} disabled={reordering} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
                <ShoppingCart size={14} /> {reordering ? "Adding..." : "Reorder"}
              </button>
            )}
            {canReturn && !showReturnForm && (
              <button onClick={() => setShowReturnForm(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                <RotateCcw size={14} /> Request Return
              </button>
            )}
          </div>
        </div>

        {/* Return Form */}
        {showReturnForm && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Request Return</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Select items to return:</p>
                {order.items.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 cursor-pointer">
                    <input type="checkbox" checked={returnItems[item.id]?.selected || false} onChange={(e) => setReturnItems({ ...returnItems, [item.id]: { ...returnItems[item.id], selected: e.target.checked } })} className="rounded border-gray-300" />
                    <span className="text-sm text-gray-900 flex-1">{item.product.title} (x{item.quantity})</span>
                    {returnItems[item.id]?.selected && (
                      <input type="number" min={1} max={item.quantity} value={returnItems[item.id]?.qty || 1} onChange={(e) => setReturnItems({ ...returnItems, [item.id]: { ...returnItems[item.id], qty: Number(e.target.value) } })} className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm" />
                    )}
                  </label>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reason *</label>
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={3} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Why are you returning these items?" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Additional notes</label>
                <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Any other details..." />
              </div>
              <div className="flex gap-3">
                <button onClick={handleReturnSubmit} disabled={submittingReturn} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">{submittingReturn ? "Submitting..." : "Submit Return Request"}</button>
                <button onClick={() => setShowReturnForm(false)} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Shipping Address</h2>
            </div>
            {order.shippingAddress ? (
              <div className="text-sm text-gray-700 space-y-1">
                {formatAddress(order.shippingAddress as any)?.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">No shipping address provided</p>}

            {/* Billing Address (shown if different from shipping) */}
            {order.billingAddress && JSON.stringify(order.billingAddress) !== JSON.stringify(order.shippingAddress) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="text-primary-600" size={16} />
                  <h3 className="font-medium text-gray-900 text-sm">Billing Address</h3>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  {formatAddress(order.billingAddress as any)?.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Payment</h2>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between"><span>Method</span><span className="font-medium">{order.payment?.provider || "COD"}</span></div>
              <div className="flex justify-between"><span>Status</span>{getPaymentStatusBadge(order.payment?.status || "PENDING")}</div>
              {order.payment?.providerRef && <div className="flex justify-between"><span>Transaction ID</span><span className="font-medium text-xs">{order.payment.providerRef}</span></div>}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100"><span>Total</span><span className="text-primary-700">{formatPrice(Number(order.totalAmount))}</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}