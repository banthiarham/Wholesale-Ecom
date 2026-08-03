"use client"

import { memo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Package, Eye, Truck, Download, RotateCcw, XCircle, RefreshCcw,
  Calendar, Clock, CheckCircle2, Hash, ShoppingBag,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

export interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  currency: string
  createdAt: string
  trackingNumber?: string | null
  carrier?: string | null
  shippingEta?: string | null
  shippingAddress: { street?: string; city?: string; state?: string; zip?: string; country?: string } | null
  payment: {
    provider: string
    status: string
    refunds?: { id: string; amount: number; status: string; createdAt: string }[]
  } | null
  deliveryPartner?: { name: string; logo: string | null; trackingUrlTemplate: string | null } | null
  deliveryTracking?: {
    status: string
    currentLocation: string | null
    estimatedDelivery: string | null
  } | null
  items: { id: string; productId: string; quantity: number; totalPrice: number; product: { title: string; thumbnail: string | null } }[]
}

// Status -> headline copy, icon and a soft/solid color pair used for the
// prominent status chip that anchors each card (Amazon/Flipkart-style).
const ORDER_STATUS_STYLES: Record<string, { headline: string; icon: any; chip: string }> = {
  PENDING: { headline: "Order Placed", icon: Clock, chip: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200" },
  CONFIRMED: { headline: "Order Confirmed", icon: CheckCircle2, chip: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200" },
  PROCESSING: { headline: "Preparing Your Order", icon: Package, chip: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200" },
  SHIPPED: { headline: "Shipped", icon: Truck, chip: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200" },
  DELIVERED: { headline: "Delivered", icon: CheckCircle2, chip: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" },
  CANCELLED: { headline: "Cancelled", icon: XCircle, chip: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" },
  REFUNDED: { headline: "Refunded", icon: RefreshCcw, chip: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200" },
}

const PAYMENT_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Payment Pending", className: "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200" },
  AUTHORIZED: { label: "Paid", className: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" },
  CAPTURED: { label: "Paid", className: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" },
  FAILED: { label: "Payment Failed", className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" },
  CANCELLED: { label: "Payment Cancelled", className: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200" },
  REFUNDED: { label: "Refunded", className: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200" },
}

// Mirrors the refund-status labels/colors shown on the Order Details page so
// the listing card and the detail page always agree (same order.payment.refunds source).
const REFUND_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Refund Pending", className: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200" },
  APPROVED: { label: "Refund Approved", className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200" },
  REJECTED: { label: "Refund Rejected", className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" },
  PROCESSED: { label: "Refunded", className: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" },
  FAILED: { label: "Refund Failed", className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" },
}

const DELIVERY_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Preparing", className: "bg-white text-gray-600 ring-1 ring-inset ring-gray-200" },
  PICKED_UP: { label: "Picked Up", className: "bg-white text-blue-700 ring-1 ring-inset ring-blue-200" },
  IN_TRANSIT: { label: "In Transit", className: "bg-white text-cyan-700 ring-1 ring-inset ring-cyan-200" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", className: "bg-white text-orange-700 ring-1 ring-inset ring-orange-200" },
  DELIVERED: { label: "Delivered", className: "bg-white text-green-700 ring-1 ring-inset ring-green-200" },
  FAILED: { label: "Failed", className: "bg-white text-red-700 ring-1 ring-inset ring-red-200" },
  RETURNED: { label: "Returned", className: "bg-white text-gray-600 ring-1 ring-inset ring-gray-200" },
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-[13px] font-semibold text-gray-800 truncate mt-0.5 ${mono ? "font-mono tracking-tight" : ""}`}>{value}</p>
    </div>
  )
}

type Variant = "solid" | "outline" | "danger"

interface ActionItem {
  key: string
  label: string
  icon: any
  href?: string
  external?: boolean
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  variant: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  solid: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-600/20 hover:shadow-md hover:shadow-primary-600/25",
  outline: "bg-white border border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700",
  danger: "bg-white border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200",
}

function ActionButton({ action, className }: { action: ActionItem; className: string }) {
  const content = (
    <>
      <action.icon size={14} />
      {action.label}
    </>
  )
  const cls = `${className} ${VARIANT_CLASSES[action.variant]} ${action.disabled ? "opacity-50 pointer-events-none" : ""}`
  if (action.href) {
    return (
      <Link href={action.href} target={action.external ? "_blank" : undefined} className={cls}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} disabled={action.disabled} className={cls}>
      {content}
    </button>
  )
}

interface OrderCardProps {
  order: Order
  isReordering: boolean
  isCancelling: boolean
  onReorder: (e: React.MouseEvent, order: Order) => void
  onCancel: (e: React.MouseEvent, order: Order) => void
}

export const OrderCard = memo(function OrderCard({ order, isReordering, isCancelling, onReorder, onCancel }: OrderCardProps) {
  const canCancel = !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)
  const canReturn = order.status === "DELIVERED"
  const canReorder = order.status !== "CANCELLED"

  const addressPreview = order.shippingAddress
    ? [order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")
    : "—"

  const statusCfg = ORDER_STATUS_STYLES[order.status] || ORDER_STATUS_STYLES.PENDING
  const latestRefund = order.payment?.refunds?.[0]
  const refundCfg = latestRefund ? REFUND_STATUS_STYLES[latestRefund.status] : null
  const paymentCfg = refundCfg || PAYMENT_STATUS_STYLES[order.payment?.status || "PENDING"] || PAYMENT_STATUS_STYLES.PENDING

  const hasShipment = !!(order.trackingNumber || order.deliveryTracking)
  const deliveryStatusCfg = order.deliveryTracking ? DELIVERY_STATUS_STYLES[order.deliveryTracking.status] : null
  const courierName = order.deliveryPartner?.name || order.carrier
  const eta = order.deliveryTracking?.estimatedDelivery || order.shippingEta
  const trackHref = `/orders/${order.id}#tracking`

  const actions: ActionItem[] = [
    { key: "view", label: "View Details", icon: Eye, href: `/orders/${order.id}`, variant: "solid" },
    { key: "track", label: "Track Order", icon: Truck, href: trackHref, variant: "outline" },
    { key: "invoice", label: "Download Invoice", icon: Download, href: `/orders/${order.id}/invoice`, external: true, variant: "outline" },
    ...(canReorder ? [{ key: "reorder", label: isReordering ? "Adding..." : "Reorder", icon: RotateCcw, onClick: (e: React.MouseEvent) => onReorder(e, order), disabled: isReordering, variant: "outline" as Variant }] : []),
    ...(canReturn ? [{ key: "return", label: "Return / Replace", icon: RefreshCcw, href: `/orders/${order.id}?action=return`, variant: "outline" as Variant }] : []),
    ...(canCancel ? [{ key: "cancel", label: isCancelling ? "Cancelling..." : "Cancel Order", icon: XCircle, onClick: (e: React.MouseEvent) => onCancel(e, order), disabled: isCancelling, variant: "danger" as Variant }] : []),
  ]

  return (
    <div className="group bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_12px_32px_-8px_rgba(16,24,40,0.14)] hover:border-gray-300/80 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 sm:px-7 py-4 bg-gray-50/70 border-b border-gray-100">
        <MetaCell label="Order Placed" value={new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
        <MetaCell label="Total" value={formatPrice(Number(order.totalAmount))} />
        <MetaCell label="Ship To" value={addressPreview} />
        <MetaCell label="Order #" value={order.orderNumber.slice(0, 8).toUpperCase()} mono />
        <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${paymentCfg.className}`}>
          {paymentCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_192px] gap-x-6">
        {/* Left: status + items + tracking */}
        <div className="min-w-0 px-5 sm:px-7 py-5 space-y-5">
          <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-bold ${statusCfg.chip}`}>
            <statusCfg.icon size={15} />
            {statusCfg.headline}
          </span>

          {/* Item rows — larger imagery, premium spacing */}
          <div className="space-y-4">
            {order.items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="w-20 h-20 sm:w-[84px] sm:h-[84px] rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0 group-hover:shadow-sm transition-shadow">
                  {item.product.thumbnail ? (
                    <Image src={item.product.thumbnail} alt={item.product.title} width={84} height={84} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={24} className="text-gray-300" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2">{item.product.title}</p>
                  <p className="text-sm text-gray-500 mt-1">Qty {item.quantity} &middot; {formatPrice(Number(item.totalPrice))}</p>
                </div>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-xs font-bold text-primary-600">+{order.items.length - 3} more item{order.items.length - 3 !== 1 ? "s" : ""} in this order</p>
            )}
          </div>

          {/* Tracking block */}
          {hasShipment && (
            <div className="rounded-xl bg-gradient-to-r from-cyan-50 to-cyan-50/40 border border-cyan-100 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white border border-cyan-100 flex items-center justify-center shrink-0 shadow-sm">
                  {order.deliveryPartner?.logo ? (
                    <Image src={order.deliveryPartner.logo} alt={courierName || "Courier"} width={20} height={20} className="object-contain" />
                  ) : (
                    <Truck size={16} className="text-cyan-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{courierName || "Courier"}</p>
                  {order.trackingNumber && (
                    <p className="text-xs text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                      <Hash size={10} /> {order.trackingNumber}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap shrink-0">
                {deliveryStatusCfg && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${deliveryStatusCfg.className}`}>
                    {deliveryStatusCfg.label}
                  </span>
                )}
                {eta && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar size={11} /> Est. {new Date(eta).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                )}
                <Link href={trackHref} className="text-xs font-bold text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1">
                  <Truck size={12} /> Track Shipment
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right: desktop action rail */}
        <div className="hidden lg:flex lg:flex-col lg:justify-center gap-2 pr-7 py-5">
          {actions.map((a) => (
            <ActionButton key={a.key} action={a} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98]" />
          ))}
        </div>
      </div>

      {/* Mobile actions */}
      <div className="lg:hidden grid grid-cols-2 gap-2 px-5 sm:px-7 py-4 border-t border-gray-100 bg-gray-50/40">
        {actions.map((a) => (
          <ActionButton
            key={a.key}
            action={a}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${a.key === "cancel" ? "col-span-2" : ""}`}
          />
        ))}
      </div>
    </div>
  )
})
