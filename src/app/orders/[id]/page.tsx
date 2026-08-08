"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle, XCircle, RotateCcw, ShoppingCart,
  Navigation, ExternalLink, Circle, Layers, Download, RefreshCcw, ClipboardCheck, PackageCheck, Home, ReceiptText,
} from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { EmptyState } from "@/components/ui/EmptyState"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/StatusBadge"
import Image from "next/image"

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  subtotal?: number | null
  taxAmount?: number | null
  shippingAmount?: number | null
  discountAmount?: number | null
  roundOffAmount?: number | null
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
  payment: {
    provider: string; status: string; amount: number; providerRef: string | null; metadata: any
    refunds?: { id: string; amount: number; status: string; reason: string | null; createdAt: string }[]
  } | null
  user: { firstName: string; lastName: string; email: string; phone: string | null }
  deliveryPartner?: { id: string; name: string; code: string; trackingUrlTemplate: string | null; logo: string | null } | null
  deliveryTracking?: { status: string; currentLocation: string | null; estimatedDelivery: string | null; events: { status: string; location: string | null; notes: string | null; occurredAt: string }[] } | null
}

const REFUND_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Refund Pending", className: "bg-orange-50 text-orange-700 border-orange-200" },
  APPROVED: { label: "Approved", className: "bg-blue-50 text-blue-700 border-blue-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
  PROCESSED: { label: "Refunded", className: "bg-green-50 text-green-700 border-green-200" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
}

const TIMELINE_STEPS = [
  { key: "PLACED", label: "Order Placed", icon: ClipboardCheck },
  { key: "PAID", label: "Payment Successful", icon: CreditCard },
  { key: "CONFIRMED", label: "Confirmed", icon: CheckCircle },
  { key: "PACKED", label: "Packed", icon: PackageCheck },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "OUT_FOR_DELIVERY", label: "Out For Delivery", icon: Navigation },
  { key: "DELIVERED", label: "Delivered", icon: Home },
]

// Derives how many of the 7 visual timeline steps are complete, combining order
// status, payment status, and (when available) live delivery tracking status —
// none of these alone maps cleanly onto the 7-stage buyer-facing timeline.
function getTimelineStepIndex(order: OrderDetail): number {
  const paymentDone =
    order.payment?.status === "CAPTURED" ||
    order.payment?.status === "AUTHORIZED" ||
    (order.payment?.provider === "COD" && order.status !== "PENDING")

  let idx = 0
  if (paymentDone) idx = 1
  if (["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) idx = Math.max(idx, 2)
  if (["PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) idx = Math.max(idx, 3)
  if (order.status === "SHIPPED" || order.status === "DELIVERED" || ["PICKED_UP", "IN_TRANSIT"].includes(order.deliveryTracking?.status || "")) idx = Math.max(idx, 4)
  if (order.deliveryTracking?.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED") idx = Math.max(idx, 5)
  if (order.status === "DELIVERED") idx = 6
  return idx
}

const POLL_INTERVAL_MS = 20000

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
  const [returnMode, setReturnMode] = useState<"RETURN" | "REPLACE">("RETURN")
  const [returnReason, setReturnReason] = useState("")
  const [returnNotes, setReturnNotes] = useState("")
  const [returnItems, setReturnItems] = useState<Record<string, { qty: number; selected: boolean }>>({})
  const [submittingReturn, setSubmittingReturn] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadOrder = useCallback((silent = false) => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    if (!silent) setLoading(true)
    fetch(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        setOrder(data.order || null)
        if (!silent && data.order) {
          const ri: Record<string, { qty: number; selected: boolean }> = {}
          data.order.items.forEach((item: any) => { ri[item.id] = { qty: item.quantity, selected: false } })
          setReturnItems(ri)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id, router])

  useEffect(() => {
    loadOrder()
    pollRef.current = setInterval(() => loadOrder(true), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadOrder])

  useEffect(() => {
    const payment = searchParams.get("payment")
    if (payment === "success") setPaymentAlert("Payment successful! Your order is confirmed.")
    if (payment === "failure") setPaymentAlert("Payment failed. Please try again or choose COD.")
    if (payment === "aborted") setPaymentAlert("Payment was cancelled. You can retry from this page.")
    if (payment === "error") setPaymentAlert("Something went wrong with the payment. Contact support if amount was deducted.")
    if (searchParams.get("action") === "return") setShowReturnForm(true)
  }, [searchParams])

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
    if (selectedItems.length === 0) { showToast("error", "Select at least one item"); return }
    if (!returnReason.trim()) { showToast("error", "Please provide a reason"); return }

    setSubmittingReturn(true)
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: order.id,
          type: returnMode === "REPLACE" ? "REPLACEMENT" : "RETURN",
          reason: returnReason,
          notes: returnNotes,
          items: selectedItems,
        }),
      })
      if (res.ok) { setShowReturnForm(false); showToast("success", returnMode === "REPLACE" ? "Replacement request submitted!" : "Return request submitted!") }
      else { const data = await res.json(); showToast("error", data.message || "Failed to submit request") }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setSubmittingReturn(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50/60">
      <main className="section-container max-w-5xl py-8 space-y-6">
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
  const isCancelled = ["CANCELLED", "REFUNDED"].includes(order.status)
  const timelineIdx = getTimelineStepIndex(order)

  // Prefer the persisted breakdown columns (real tax/shipping/round-off actually
  // charged); older orders placed before these columns existed fall back to a
  // derived balancing figure so they still render sensibly.
  const hasPersistedBreakdown = order.subtotal != null
  const derivedSubtotal = order.items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const subtotal = hasPersistedBreakdown ? Number(order.subtotal) : derivedSubtotal
  const shippingFee = hasPersistedBreakdown ? Number(order.shippingAmount ?? 0) : 0
  const taxAmount = hasPersistedBreakdown
    ? Number(order.taxAmount ?? 0)
    : Math.max(0, Number(order.totalAmount) - derivedSubtotal - shippingFee)
  const discountAmount = hasPersistedBreakdown ? Number(order.discountAmount ?? 0) : 0
  const roundOffAmount = hasPersistedBreakdown ? Number(order.roundOffAmount ?? 0) : 0

  return (
    <div className="min-h-screen bg-gray-50/60">
      <main className="section-container max-w-5xl py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 text-sm font-medium"><ArrowLeft size={16} /> Back to orders</Link>
          <Link href={`/orders/${order.id}/invoice`} target="_blank" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={15} /> Download Invoice
          </Link>
        </div>

        {paymentAlert && (
          <div className={`mb-6 p-4 rounded-xl border ${paymentAlert.includes("successful") ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <p className="font-medium text-sm">{paymentAlert}</p>
          </div>
        )}

        <div className="card-base-static p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber.slice(0, 8).toUpperCase()}</h1>
              <p className="text-sm text-gray-500 mt-1">Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <OrderStatusBadge status={order.status} />
              {canCancel && <button onClick={cancelOrder} disabled={cancelling} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50">{cancelling ? "Cancelling..." : "Cancel"}</button>}
            </div>
          </div>
        </div>

        {/* Visual tracking timeline */}
        <div id="tracking" className="card-base-static p-6 mb-6 scroll-mt-24">
          <h2 className="font-semibold text-gray-900 mb-6 flex items-center gap-2"><Navigation size={16} className="text-primary-600" /> Order Tracking</h2>

          {isCancelled ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <XCircle size={22} className="text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700">This order was {order.status === "REFUNDED" ? "refunded" : "cancelled"} and is no longer being processed.</p>
            </div>
          ) : (
            <>
              {/* Desktop: horizontal */}
              <div className="hidden md:flex items-start">
                {TIMELINE_STEPS.map((step, i) => {
                  const done = i <= timelineIdx
                  const current = i === timelineIdx && timelineIdx < TIMELINE_STEPS.length - 1
                  const StepIcon = step.icon
                  return (
                    <div key={step.key} className="flex-1 flex items-start">
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 90 }}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${done ? "bg-primary-600 text-white shadow-[0_4px_12px_-2px_rgba(3,105,161,0.4)]" : "bg-gray-100 text-gray-400"} ${current ? "ring-4 ring-primary-100" : ""}`}>
                          <StepIcon size={16} />
                        </div>
                        <span className={`text-[11px] text-center mt-2 leading-tight font-medium ${done ? "text-primary-700" : "text-gray-400"}`}>{step.label}</span>
                        {i === 0 && <span className="text-[10px] text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</span>}
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mt-5 transition-all duration-300 ${i < timelineIdx ? "bg-primary-600" : "bg-gray-200"}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Mobile: vertical */}
              <div className="md:hidden space-y-0">
                {TIMELINE_STEPS.map((step, i) => {
                  const done = i <= timelineIdx
                  const StepIcon = step.icon
                  return (
                    <div key={step.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                          <StepIcon size={14} />
                        </div>
                        {i < TIMELINE_STEPS.length - 1 && <div className={`w-0.5 flex-1 min-h-[24px] ${i < timelineIdx ? "bg-primary-600" : "bg-gray-200"}`} />}
                      </div>
                      <div className="pb-5">
                        <p className={`text-sm font-medium ${done ? "text-primary-700" : "text-gray-400"}`}>{step.label}</p>
                        {i === 0 && <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Live shipment tracking */}
          {(order.trackingNumber || order.carrier || order.shippingEta || order.deliveryPartner || order.deliveryTracking) && (
            <div className="mt-6 bg-blue-50/70 border border-blue-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <Navigation size={13} className="text-white" />
                </div>
                <span className="text-sm font-bold text-blue-900">Shipment Tracking</span>
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
        </div>

        <div className="card-base-static p-6 mb-6">
          <div className="pt-0">
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
                                {item.product.thumbnail ? <Image src={item.product.thumbnail} alt={item.product.title} width={40} height={40} className="w-10 h-10 rounded object-cover" /> : <Package size={20} className="text-gray-400" />}
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
                          {item.product.thumbnail ? <Image src={item.product.thumbnail} alt={item.product.title} width={64} height={64} className="w-full h-full object-cover" /> : <Package size={24} className="text-gray-400" />}
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

          {/* Price breakdown */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><ReceiptText size={16} className="text-primary-600" /> Order Summary</h2>
            <div className="text-sm text-gray-600 space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between"><span>Subtotal</span><span className="text-gray-900">{formatPrice(subtotal)}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between"><span>Discount</span><span className="text-green-600 font-medium">-{formatPrice(discountAmount)}</span></div>
              )}
              <div className="flex justify-between"><span>Shipping</span><span className="text-green-600 font-medium">{shippingFee === 0 ? "Free" : formatPrice(shippingFee)}</span></div>
              <div className="flex justify-between"><span>GST / Taxes</span><span className="text-gray-900">{formatPrice(taxAmount)}</span></div>
              {roundOffAmount !== 0 && (
                <div className="flex justify-between"><span>Round off</span><span className="text-gray-900">{roundOffAmount > 0 ? "+" : "-"}{formatPrice(Math.abs(roundOffAmount))}</span></div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100"><span className="text-gray-900">Grand Total</span><span className="text-primary-700">{formatPrice(Number(order.totalAmount))}</span></div>
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
                <RefreshCcw size={14} /> Return / Replace
              </button>
            )}
          </div>
        </div>

        {/* Return / Replace Form */}
        {showReturnForm && (
          <div className="card-base-static p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Request Return / Replacement</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                {(["RETURN", "REPLACE"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setReturnMode(mode)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${returnMode === mode ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"}`}
                  >
                    {mode === "RETURN" ? "Return for Refund" : "Replace Item"}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Select items:</p>
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
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={3} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder={returnMode === "REPLACE" ? "Why do you need a replacement?" : "Why are you returning these items?"} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Additional notes</label>
                <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Any other details..." />
              </div>
              <div className="flex gap-3">
                <button onClick={handleReturnSubmit} disabled={submittingReturn} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">{submittingReturn ? "Submitting..." : `Submit ${returnMode === "REPLACE" ? "Replacement" : "Return"} Request`}</button>
                <button onClick={() => setShowReturnForm(false)} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <ReceiptText className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Billing Address</h2>
            </div>
            {order.billingAddress ? (
              <div className="text-sm text-gray-700 space-y-1">
                <p>{order.billingAddress.street}</p>
                <p>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.zip}</p>
                <p>{order.billingAddress.country}</p>
              </div>
            ) : <p className="text-sm text-gray-500">Same as shipping address</p>}
          </div>

          <div className="card-base-static p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Payment</h2>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between"><span>Method</span><span className="font-medium">{order.payment?.provider || "COD"}</span></div>
              <div className="flex justify-between items-center"><span>Status</span><PaymentStatusBadge status={order.payment?.status || "PENDING"} /></div>
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

              {order.payment?.refunds && order.payment.refunds.length > 0 && (() => {
                const refund = order.payment!.refunds![0]
                const cfg = REFUND_STATUS_CONFIG[refund.status] || REFUND_STATUS_CONFIG.PENDING
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Refund</p>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span>Refund Amount</span><span className="font-medium text-gray-900">{formatPrice(Number(refund.amount))}</span></div>
                      <div className="flex justify-between items-center">
                        <span>Refund Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}>{cfg.label}</span>
                      </div>
                      <div className="flex justify-between"><span>Requested Date</span><span className="font-medium text-gray-900">{new Date(refund.createdAt).toLocaleDateString()}</span></div>
                    </div>
                  </div>
                )
              })()}

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
