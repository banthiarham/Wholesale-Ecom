"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle, XCircle, AlertCircle, RotateCcw, ShoppingCart, Navigation, ExternalLink, Circle, Clock, Layers } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { EmptyState } from "@/components/ui/EmptyState"

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
  payment: { provider: string; status: string; amount: number; providerRef: string | null; metadata: any } | null
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
  const [retrying, setRetrying] = useState(false)
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

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
      case "DELIVERED": return "badge-success"
      case "SHIPPED": return "badge-primary"
      case "PROCESSING": return "badge-warning"
      case "CANCELLED": return "badge-danger"
      default: return "badge bg-gray-100 text-gray-700"
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
      if (res.ok) { const data = await res.json(); setOrder(data.order) } else { showToast("error", "Failed to cancel order") }
    } catch { showToast("error", "Something went wrong") } finally { setCancelling(false) }
  }

  const retryPayment = async () => {
    if (!order) return
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    setRetrying(true)
    try {
      const initRes = await fetch(
        `/api/payments/initiate/${order.id}?provider=RAZORPAY&returnUrl=${encodeURIComponent(`${window.location.origin}/orders/${order.id}`)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      )
      const initData = await initRes.json()
      if (!initRes.ok || !initData.providerOrderId) {
        showToast("error", initData.message || "Failed to start payment retry. Please contact support.")
        setRetrying(false)
        return
      }

      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.async = true
      script.onload = () => {
        const options: any = {
          key: initData.keyId,
          order_id: initData.providerOrderId,
          name: "WholesaleX",
          amount: initData.extra?.amount,
          currency: initData.extra?.currency || "INR",
          prefill: {
            name: initData.extra?.customerName || "",
            email: initData.extra?.customerEmail || "",
            contact: initData.extra?.customerPhone || "",
          },
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch("/api/payments/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              })
              setPaymentAlert(verifyRes.ok ? "Payment successful! Your order is confirmed." : "Payment failed. Please try again.")
              if (verifyRes.ok) {
                const refreshed = await fetch(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
                setOrder(refreshed.order || order)
              }
            } catch {
              setPaymentAlert("Something went wrong verifying your payment. Contact support if the amount was deducted.")
            } finally {
              setRetrying(false)
            }
          },
          modal: { ondismiss: function () { setRetrying(false) } },
        }
        const rzp = new (window as any).Razorpay(options)
        rzp.on("payment.failed", function () {
          showToast("error", "Payment failed. Please try again.")
          setRetrying(false)
        })
        rzp.open()
      }
      script.onerror = () => {
        showToast("error", "Could not load the Razorpay checkout. Please check your internet connection and try again.")
        setRetrying(false)
      }
      document.body.appendChild(script)
    } catch {
      showToast("error", "Something went wrong")
      setRetrying(false)
    }
  }

  const handleReorder = async () => {
    if (!order) return
    setReordering(true)
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
      setReordering(false)
    }
  }

  const handleReturnSubmit = async () => {
    if (!order) return
    const token = localStorage.getItem("token")
    if (!token) return
    const selectedItems = Object.entries(returnItems).filter(([, v]) => v.selected).map(([id, v]) => ({ orderItemId: id, quantity: v.qty }))
    if (selectedItems.length === 0) { showToast("error", "Select at least one item to return"); return }
    if (!returnReason.trim()) { showToast("error", "Please provide a reason"); return }

    setSubmittingReturn(true)
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.id, reason: returnReason, notes: returnNotes, items: selectedItems }),
      })
      if (res.ok) { setShowReturnForm(false); showToast("success", "Return request submitted!") }
      else { const data = await res.json(); showToast("error", data.message || "Failed to submit return") }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setSubmittingReturn(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
      </main>
    </div>
  )
  if (!order) return (
    <div className="min-h-screen bg-gray-50">
      <EmptyState icon={Package} title="Order not found" action={{ label: "Back to orders", href: "/orders" }} />
    </div>
  )

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

        <div className="card-base-static p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge inline-flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
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
              {(() => {
                const packageGroups = new Map<string, any[]>()
                const standaloneItems: any[] = []

                for (const item of order.items) {
                  const meta = (item as any).metadata
                  const packageId = meta?.packageId
                  if (packageId) {
                    if (!packageGroups.has(packageId)) packageGroups.set(packageId, [])
                    packageGroups.get(packageId)!.push(item)
                  } else {
                    standaloneItems.push(item)
                  }
                }

                return (
                  <>
                    {Array.from(packageGroups.entries()).map(([packageId, items]) => {
                      const firstMeta = (items[0] as any).metadata
                      const packageTitle = firstMeta?.packageTitle || "Custom Package"
                      const selectedComponents = firstMeta?.selectedComponents || []
                      const groupDiscounts = firstMeta?.groupDiscounts || []
                      const packageTotal = firstMeta?.packageTotal ?? items.reduce((sum: number, i: any) => sum + Number(i.totalPrice), 0)

                      return (
                        <div key={packageId} className="bg-primary-50 rounded-xl border border-primary-200 overflow-hidden">
                          <div className="px-4 py-3 bg-primary-100 flex items-center gap-2">
                            <Layers size={16} className="text-primary-600" />
                            <span className="font-semibold text-primary-800">{packageTitle}</span>
                            <span className="text-xs bg-primary-200 text-primary-700 px-2 py-0.5 rounded-full">Package</span>
                          </div>
                          <div className="divide-y divide-primary-100">
                            {selectedComponents.length > 0 ? selectedComponents.map((comp: any) => (
                              <div key={comp.productId} className="px-4 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">{comp.groupName}</span>
                                  <span className="text-sm font-medium text-gray-900">{comp.productTitle}</span>
                                </div>
                                <span className="text-sm text-gray-700">{formatPrice(comp.unitPrice)}</span>
                              </div>
                            )) : items.map((item: any) => (
                              <div key={item.id} className="px-4 py-2 flex items-center gap-3">
                                {item.product.thumbnail ? <img src={item.product.thumbnail} alt={item.product.title} className="w-10 h-10 rounded object-cover" /> : <Package size={20} className="text-gray-400" />}
                                <span className="text-sm font-medium text-gray-900 flex-1">{item.product.title}</span>
                                <span className="text-sm text-gray-700">{formatPrice(Number(item.totalPrice))}</span>
                              </div>
                            ))}
                          </div>
                          {groupDiscounts.length > 0 && (
                            <div className="px-4 py-2 bg-green-50">
                              {groupDiscounts.map((d: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs text-green-700">
                                  <span>{d.groupName} discount</span>
                                  <span>-{formatPrice(d.discountAmount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="px-4 py-2 flex justify-between items-center border-t border-primary-200">
                            <span className="font-bold text-gray-900">Package Total</span>
                            <span className="font-bold text-primary-700">{formatPrice(packageTotal)}</span>
                          </div>
                        </div>
                      )
                    })}
                    {standaloneItems.map((item) => (
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
                  </>
                )
              })()}
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
          <div className="card-base-static p-6 mb-6">
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
          <div className="card-base-static p-6">
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
            ) : <p className="text-sm text-gray-500">No shipping address provided</p>}
          </div>

          <div className="card-base-static p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Payment</h2>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between"><span>Method</span><span className="font-medium">{order.payment?.provider || "COD"}</span></div>
              <div className="flex justify-between"><span>Status</span>{getPaymentStatusBadge(order.payment?.status || "PENDING")}</div>
              {order.payment?.providerRef && <div className="flex justify-between"><span>Transaction ID</span><span className="font-medium text-xs">{order.payment.providerRef}</span></div>}
              {order.payment?.metadata?.razorpayOrderId && (
                <div className="flex justify-between"><span>Razorpay Order ID</span><span className="font-medium text-xs">{order.payment.metadata.razorpayOrderId}</span></div>
              )}
              {order.payment?.metadata?.razorpayPaymentId && (
                <div className="flex justify-between"><span>Razorpay Payment ID</span><span className="font-medium text-xs">{order.payment.metadata.razorpayPaymentId}</span></div>
              )}
              {order.payment?.metadata?.verifiedAt && (
                <div className="flex justify-between"><span>Verified At</span><span className="font-medium text-xs">{new Date(order.payment.metadata.verifiedAt).toLocaleString()}</span></div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100"><span>Total</span><span className="text-primary-700">{formatPrice(Number(order.totalAmount))}</span></div>
              {order.payment?.provider === "RAZORPAY" && ["FAILED", "PENDING"].includes(order.payment?.status || "") && !["CANCELLED", "DELIVERED", "REFUNDED"].includes(order.status) && (
                <button
                  onClick={retryPayment}
                  disabled={retrying}
                  className="w-full mt-2 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {retrying ? "Processing..." : "Retry Payment"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}