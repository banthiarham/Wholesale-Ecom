"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft, Navigation, ClipboardCheck, CreditCard, CheckCircle, PackageCheck, Truck, Home, XCircle,
  MapPin, ReceiptText, User, Layers, ExternalLink, Plug, FileText, Package,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { AdminStatusBadge, type AdminBadgeVariant } from "@/lib/adminStatusBadge"
import { paymentModeLabel } from "@/lib/paymentMode"
import { useToast } from "@/components/ui/Toast"

interface OrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  metadata?: any
  product: { id: string; title: string; thumbnail: string | null; sku: string | null }
}

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
  createdAt: string
  deliveredAt?: string | null
  shippingAddress: any
  billingAddress: any
  notes?: string | null
  trackingNumber?: string | null
  carrier?: string | null
  shippingEta?: string | null
  items: OrderItem[]
  payment: {
    provider: string
    status: string
    amount: number
    providerRef: string | null
    refunds?: { id: string; amount: number; status: string; reason: string | null; createdAt: string }[]
  } | null
  paymentStatus?: string
  user: { firstName: string; lastName: string; email: string; phone: string | null; companyName?: string | null; gstin?: string | null } | null
  deliveryPartner?: { id: string; name: string; code: string; trackingUrlTemplate: string | null } | null
  deliveryTracking?: { status: string; currentLocation: string | null; estimatedDelivery: string | null; events: { status: string; location: string | null; notes: string | null; occurredAt: string }[] } | null
}

interface Partner {
  id: string
  name: string
  code: string
  apiEnabled: boolean
  trackingUrlTemplate?: string | null
}

const STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

const TIMELINE_STEPS = [
  { key: "PLACED", label: "Order Placed", icon: ClipboardCheck },
  { key: "PAID", label: "Payment Successful", icon: CreditCard },
  { key: "CONFIRMED", label: "Confirmed", icon: CheckCircle },
  { key: "PACKED", label: "Packed", icon: PackageCheck },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "OUT_FOR_DELIVERY", label: "Out For Delivery", icon: Navigation },
  { key: "DELIVERED", label: "Delivered", icon: Home },
]

const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Refund Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PROCESSED: "Refunded",
  FAILED: "Failed",
}

const REFUND_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  APPROVED: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  PROCESSED: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
}

function getTimelineStepIndex(order: OrderDetail): number {
  const paymentDone =
    order.payment?.status === "CAPTURED" ||
    order.payment?.status === "AUTHORIZED" ||
    ((order.payment?.provider || "COD") === "COD" && order.status !== "PENDING")
  let idx = 0
  if (paymentDone) idx = 1
  if (["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) idx = Math.max(idx, 2)
  if (["PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) idx = Math.max(idx, 3)
  if (order.status === "SHIPPED" || order.status === "DELIVERED" || ["PICKED_UP", "IN_TRANSIT"].includes(order.deliveryTracking?.status || "")) idx = Math.max(idx, 4)
  if (order.deliveryTracking?.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED") idx = Math.max(idx, 5)
  if (order.status === "DELIVERED") idx = 6
  return idx
}

function orderStatusBadgeProps(status: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
  switch (status) {
    case "PENDING": return { variant: "warning" }
    case "PROCESSING": return { variant: "primary" }
    case "SHIPPED": return { colorClassName: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" }
    case "DELIVERED": return { variant: "success" }
    default: return { variant: "neutral" }
  }
}

const inputCls =
  "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"

function AddressBlock({ address }: { address: any }) {
  if (!address) return <p className="text-sm text-gray-500 dark:text-gray-400">No address provided</p>
  const line1 = address.street || address.line1
  const cityLine = [address.city, address.state].filter(Boolean).join(", ") + (address.zip || address.postalCode ? ` ${address.zip || address.postalCode}` : "")
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
      {line1 && <p>{line1}</p>}
      {address.line2 && <p>{address.line2}</p>}
      {cityLine.trim() && <p>{cityLine}</p>}
      {address.country && <p>{address.country}</p>}
    </div>
  )
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { showToast } = useToast()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [partners, setPartners] = useState<Partner[]>([])
  const [trackingNumber, setTrackingNumber] = useState("")
  const [carrier, setCarrier] = useState("")
  const [selectedPartnerId, setSelectedPartnerId] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : "")
  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` })

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) { setNotFound(true); return }
      const data = await res.json()
      const o: OrderDetail = data.order || data
      setOrder(o)
      setTrackingNumber(o.trackingNumber || "")
      setCarrier(o.carrier || "")
      setSelectedPartnerId(o.deliveryPartner?.id || "")
    } catch (err) {
      console.error(err)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
    fetch("/api/delivery-partners").then((r) => r.json()).then(setPartners).catch((err) => console.error("Failed to fetch delivery partners:", err))
  }, [loadOrder])

  // Runs an admin action, then reloads the full order so every card reflects the change.
  const run = async (key: string, url: string, init: RequestInit, successMsg: string) => {
    setBusy(key)
    try {
      const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Something went wrong")
      showToast("success", successMsg)
      await loadOrder()
    } catch (err: any) {
      showToast("error", err.message || "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  const updateStatus = (status: string) =>
    run(`status:${status}`, `/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }, `Status changed to ${status}`)

  const cancelOrder = () => {
    if (!confirm("Cancel this order?")) return
    run("cancel", `/api/orders/${id}/cancel`, { method: "PUT" }, "Order cancelled")
  }

  const refundAction = (action: "approve" | "reject" | "mark-refunded") =>
    run(`refund:${action}`, `/api/orders/${id}/refund/${action}`, { method: "PUT" }, "Refund updated")

  const saveTracking = () => {
    const payload: any = {}
    if (trackingNumber) payload.trackingNumber = trackingNumber
    if (carrier && !selectedPartnerId) payload.carrier = carrier
    if (selectedPartnerId) payload.deliveryPartnerId = selectedPartnerId
    run("tracking", `/api/orders/${id}/tracking`, { method: "PUT", body: JSON.stringify(payload) }, "Tracking updated")
  }

  const createShipment = () =>
    run("shipment", `/api/orders/${id}/create-shipment`, { method: "POST" }, "Shipment created")

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-700 border-b-primary-600" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="admin-card-static p-12 text-center">
        <Package className="mx-auto text-gray-300 dark:text-gray-600" size={40} />
        <p className="mt-3 text-gray-500 dark:text-gray-400">Order not found</p>
        <Link href="/admin/orders" className="mt-2 inline-block text-primary-600 dark:text-primary-400 text-sm hover:underline">Back to orders</Link>
      </div>
    )
  }

  const isCancelled = ["CANCELLED", "REFUNDED"].includes(order.status)
  const timelineIdx = getTimelineStepIndex(order)
  const refund = order.payment?.refunds?.[0] || null
  const paymentStatus = (order.payment?.status || order.paymentStatus || "PENDING").toUpperCase()
  const selectedPartner = partners.find((p) => p.id === selectedPartnerId)

  const hasBreakdown = order.subtotal != null
  const derivedSubtotal = order.items.reduce((sum, i) => sum + Number(i.totalPrice), 0)
  const subtotal = hasBreakdown ? Number(order.subtotal) : derivedSubtotal
  const shippingFee = hasBreakdown ? Number(order.shippingAmount ?? 0) : 0
  const taxAmount = hasBreakdown ? Number(order.taxAmount ?? 0) : Math.max(0, Number(order.totalAmount) - derivedSubtotal - shippingFee)
  const discountAmount = hasBreakdown ? Number(order.discountAmount ?? 0) : 0
  const roundOffAmount = hasBreakdown ? Number(order.roundOffAmount ?? 0) : 0

  // Group package components together; everything else is a standalone line.
  const packageGroups = new Map<string, OrderItem[]>()
  const standalone: OrderItem[] = []
  for (const item of order.items) {
    const pid = item.metadata?.packageId
    if (pid) {
      if (!packageGroups.has(pid)) packageGroups.set(pid, [])
      packageGroups.get(pid)!.push(item)
    } else standalone.push(item)
  }

  const trackingUrl =
    order.deliveryPartner?.trackingUrlTemplate && order.trackingNumber
      ? order.deliveryPartner.trackingUrlTemplate.replace("{trackingNumber}", order.trackingNumber)
      : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            <ArrowLeft size={16} /> Back to orders
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Order #{order.orderNumber}</h1>
            <AdminStatusBadge status={order.status} {...orderStatusBadgeProps(order.status)} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <Link
          href={`/orders/${order.id}/invoice`}
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-sm"
        >
          <FileText size={16} /> View Invoice
        </Link>
      </div>

      {/* Tracking timeline */}
      <div className="admin-card-static p-6">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
          <Navigation size={16} className="text-primary-600 dark:text-primary-400" /> Order Tracking
        </h2>
        {isCancelled ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
            <XCircle size={22} className="text-red-500 flex-shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">This order was {order.status === "REFUNDED" ? "refunded" : "cancelled"} and is no longer being processed.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:flex items-start">
              {TIMELINE_STEPS.map((step, i) => {
                const done = i <= timelineIdx
                const current = i === timelineIdx && timelineIdx < TIMELINE_STEPS.length - 1
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex-1 flex items-start">
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 90 }}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${done ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"} ${current ? "ring-4 ring-primary-100 dark:ring-primary-900/40" : ""}`}>
                        <Icon size={16} />
                      </div>
                      <span className={`text-[11px] text-center mt-2 leading-tight font-medium ${done ? "text-primary-700 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}`}>{step.label}</span>
                      {i === 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</span>}
                      {i === 6 && order.deliveredAt && done && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{new Date(order.deliveredAt).toLocaleDateString()}</span>}
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && <div className={`flex-1 h-0.5 mt-5 ${i < timelineIdx ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"}`} />}
                  </div>
                )
              })}
            </div>
            <div className="md:hidden">
              {TIMELINE_STEPS.map((step, i) => {
                const done = i <= timelineIdx
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"}`}>
                        <Icon size={14} />
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && <div className={`w-0.5 flex-1 min-h-[24px] ${i < timelineIdx ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"}`} />}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-medium ${done ? "text-primary-700 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}`}>{step.label}</p>
                      {i === 0 && <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {(order.trackingNumber || order.deliveryPartner || order.carrier) && (
          <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100"><Truck size={16} className="text-primary-600 dark:text-primary-400" /> Shipment</div>
            {(order.deliveryPartner?.name || order.carrier) && <p className="text-gray-600 dark:text-gray-400">Carrier: <span className="text-gray-900 dark:text-gray-100">{order.deliveryPartner?.name || order.carrier}</span></p>}
            {order.trackingNumber && <p className="text-gray-600 dark:text-gray-400">Tracking #: <span className="font-mono text-gray-900 dark:text-gray-100">{order.trackingNumber}</span></p>}
            {order.deliveryTracking?.currentLocation && <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1"><MapPin size={12} /> {order.deliveryTracking.currentLocation}</p>}
            {trackingUrl && <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"><ExternalLink size={12} /> Track shipment</a>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items + summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="admin-card-static p-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Items</h2>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from(packageGroups.entries()).map(([pid, items]) => {
                const meta = items[0].metadata
                const components = meta?.selectedComponents || []
                const groupDiscounts = meta?.groupDiscounts || []
                const total = meta?.packageTotal ?? items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
                return (
                  <div key={pid} className="py-4 first:pt-0">
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Layers size={14} className="text-primary-600 dark:text-primary-400" />
                        <span className="text-sm font-semibold text-primary-800 dark:text-primary-300">{meta?.packageTitle || "Custom Package"}</span>
                        <span className="text-[10px] bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full">Package</span>
                      </div>
                      {components.length > 0
                        ? components.map((c: any) => (
                            <div key={c.productId} className="flex justify-between text-xs ml-5">
                              <span className="text-gray-700 dark:text-gray-300"><span className="text-gray-400 dark:text-gray-500">{c.groupName}:</span> {c.productTitle}</span>
                              <span className="text-gray-600 dark:text-gray-400">{formatPrice(c.unitPrice)}</span>
                            </div>
                          ))
                        : items.map((i) => (
                            <div key={i.id} className="flex justify-between text-xs ml-5">
                              <span className="text-gray-700 dark:text-gray-300">{i.product.title} × {i.quantity}</span>
                              <span className="text-gray-600 dark:text-gray-400">{formatPrice(Number(i.unitPrice) * i.quantity)}</span>
                            </div>
                          ))}
                      {groupDiscounts.map((d: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-green-600 dark:text-green-400 ml-5">
                          <span>{d.groupName} discount</span><span>-{formatPrice(d.discountAmount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold mt-2 border-t border-primary-200 dark:border-primary-700 pt-2">
                        <span className="text-gray-900 dark:text-gray-100">Package Total</span>
                        <span className="text-primary-700 dark:text-primary-400">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {standalone.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 grid place-items-center">
                    {item.product.thumbnail
                      ? <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-contain" />
                      : <Package size={22} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.product.title}</p>
                    {item.product.sku && <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.product.sku}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(item.totalPrice))}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatPrice(Number(item.unitPrice))} each</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <ReceiptText size={16} className="text-primary-600 dark:text-primary-400" /> Order Summary
              </h2>
              <div className="ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Subtotal</span><span className="text-gray-900 dark:text-gray-100">{formatPrice(subtotal)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Discount</span><span className="text-green-600 dark:text-green-400">-{formatPrice(discountAmount)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Shipping</span><span className={shippingFee === 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-gray-100"}>{shippingFee === 0 ? "Free" : formatPrice(shippingFee)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">GST / Taxes</span><span className="text-gray-900 dark:text-gray-100">{formatPrice(taxAmount)}</span></div>
                {roundOffAmount !== 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Round off</span><span className="text-gray-900 dark:text-gray-100">{roundOffAmount > 0 ? "" : "-"}{formatPrice(Math.abs(roundOffAmount))}</span></div>}
                <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2 text-base font-bold">
                  <span className="text-gray-900 dark:text-gray-100">Grand Total</span>
                  <span className="text-primary-700 dark:text-primary-400">{formatPrice(Number(order.totalAmount))}</span>
                </div>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="admin-card-static p-6">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Order Notes</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="admin-card-static p-6">
              <div className="flex items-center gap-2 mb-4"><MapPin size={18} className="text-primary-600 dark:text-primary-400" /><h2 className="font-semibold text-gray-900 dark:text-gray-100">Shipping Address</h2></div>
              <AddressBlock address={order.shippingAddress} />
            </div>
            <div className="admin-card-static p-6">
              <div className="flex items-center gap-2 mb-4"><ReceiptText size={18} className="text-primary-600 dark:text-primary-400" /><h2 className="font-semibold text-gray-900 dark:text-gray-100">Billing Address</h2></div>
              <AddressBlock address={order.billingAddress || order.shippingAddress} />
            </div>
          </div>
        </div>

        {/* Right: customer, payment, actions */}
        <div className="space-y-6">
          <div className="admin-card-static p-6">
            <div className="flex items-center gap-2 mb-4"><User size={18} className="text-primary-600 dark:text-primary-400" /><h2 className="font-semibold text-gray-900 dark:text-gray-100">Customer</h2></div>
            {order.user ? (
              <div className="text-sm space-y-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">{order.user.firstName} {order.user.lastName}</p>
                <p className="text-gray-600 dark:text-gray-400">{order.user.email}</p>
                {order.user.phone && <p className="text-gray-600 dark:text-gray-400">{order.user.phone}</p>}
                {order.user.companyName && <p className="text-gray-600 dark:text-gray-400">{order.user.companyName}</p>}
                {order.user.gstin && <p className="text-gray-600 dark:text-gray-400">GSTIN: <span className="font-mono">{order.user.gstin}</span></p>}
              </div>
            ) : <p className="text-sm text-gray-500 dark:text-gray-400">Guest order</p>}
          </div>

          <div className="admin-card-static p-6">
            <div className="flex items-center gap-2 mb-4"><CreditCard size={18} className="text-primary-600 dark:text-primary-400" /><h2 className="font-semibold text-gray-900 dark:text-gray-100">Payment</h2></div>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Method</span><span className="text-gray-900 dark:text-gray-100">{paymentModeLabel(order.payment?.provider)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Status</span><span className="uppercase font-medium text-gray-900 dark:text-gray-100">{paymentStatus.replace(/_/g, " ")}</span></div>
              {order.payment?.providerRef && <div className="flex justify-between gap-2"><span className="text-gray-600 dark:text-gray-400">Reference</span><span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{order.payment.providerRef}</span></div>}
              <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2 font-bold"><span className="text-gray-900 dark:text-gray-100">Total</span><span className="text-primary-700 dark:text-primary-400">{formatPrice(Number(order.totalAmount))}</span></div>
            </div>

            {refund && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Refund</h3>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Amount</span><span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(refund.amount))}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${REFUND_STATUS_BADGE[refund.status] || REFUND_STATUS_BADGE.PENDING}`}>{REFUND_STATUS_LABELS[refund.status] || refund.status}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Requested</span><span className="text-gray-900 dark:text-gray-100">{new Date(refund.createdAt).toLocaleDateString()}</span></div>
                </div>
                {refund.status === "PENDING" && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => refundAction("approve")} disabled={!!busy} className="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">{busy === "refund:approve" ? "Approving..." : "Approve Refund"}</button>
                    <button onClick={() => refundAction("reject")} disabled={!!busy} className="px-3 py-1.5 text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition">{busy === "refund:reject" ? "Rejecting..." : "Reject Refund"}</button>
                  </div>
                )}
                {refund.status === "APPROVED" && (
                  <button onClick={() => refundAction("mark-refunded")} disabled={!!busy} className="mt-3 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition">{busy === "refund:mark-refunded" ? "Saving..." : "Mark as Refunded"}</button>
                )}
              </div>
            )}
          </div>

          {/* Status actions */}
          {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
            <div className="admin-card-static p-6">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Update Status</h2>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== order.status && s !== "CANCELLED").map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={!!busy}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 dark:text-gray-200 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 disabled:opacity-50 transition"
                  >
                    {busy === `status:${s}` ? "Saving..." : `Mark ${s.charAt(0) + s.slice(1).toLowerCase()}`}
                  </button>
                ))}
                <button
                  onClick={cancelOrder}
                  disabled={!!busy}
                  className="px-3 py-1.5 text-xs border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
                >
                  {busy === "cancel" ? "Cancelling..." : "Cancel Order"}
                </button>
              </div>
            </div>
          )}

          {/* Tracking */}
          {order.status !== "CANCELLED" && (
            <div className="admin-card-static p-6">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><Truck size={16} className="text-primary-600 dark:text-primary-400" /> Update Tracking</h2>
              <div className="space-y-3">
                <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)} className={inputCls}>
                  <option value="">Select Delivery Partner (optional)</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                {selectedPartner?.apiEnabled && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <Plug size={12} /> API Connected
                  </span>
                )}
                <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking Number" className={inputCls} />
                {!selectedPartnerId && (
                  <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier name" className={inputCls} />
                )}
                {selectedPartner?.trackingUrlTemplate && trackingNumber && (
                  <a href={selectedPartner.trackingUrlTemplate.replace("{trackingNumber}", trackingNumber)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline">
                    <ExternalLink size={12} /> Preview tracking link
                  </a>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={saveTracking} disabled={!!busy} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{busy === "tracking" ? "Saving..." : "Save Tracking"}</button>
                  {selectedPartner?.apiEnabled && (
                    <button onClick={createShipment} disabled={!!busy} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                      <Truck size={14} /> {busy === "shipment" ? "Creating..." : `Create Shipment via ${selectedPartner.name}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
