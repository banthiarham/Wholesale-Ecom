"use client"

import { CheckCircle2, Clock, XCircle, AlertCircle, Package, Truck, RefreshCcw } from "lucide-react"

// Centralizes order-status badge styling — previously duplicated with slightly
// different mappings across the orders list, order detail, and invoice pages.
const ORDER_STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  PENDING: { label: "Pending", className: "bg-gray-100 text-gray-700", icon: Clock },
  CONFIRMED: { label: "Confirmed", className: "bg-primary-50 text-primary-700", icon: CheckCircle2 },
  PROCESSING: { label: "Processing", className: "bg-amber-50 text-amber-700", icon: Package },
  SHIPPED: { label: "Shipped", className: "bg-primary-50 text-primary-700", icon: Truck },
  DELIVERED: { label: "Delivered", className: "bg-green-50 text-green-700", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700", icon: XCircle },
  REFUNDED: { label: "Refunded", className: "bg-gray-100 text-gray-700", icon: RefreshCcw },
}

export function OrderStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const cfg = ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide rounded-full ${cfg.className} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <Icon size={size === "sm" ? 11 : 13} />
      {cfg.label}
    </span>
  )
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  CAPTURED: { label: "Paid", className: "text-green-600", icon: CheckCircle2 },
  AUTHORIZED: { label: "Paid", className: "text-green-600", icon: CheckCircle2 },
  FAILED: { label: "Payment Failed", className: "text-red-500", icon: XCircle },
  CANCELLED: { label: "Payment Cancelled", className: "text-gray-500", icon: XCircle },
  PENDING: { label: "Payment Pending", className: "text-amber-600", icon: AlertCircle },
  REFUND_PENDING: { label: "Refund Pending", className: "text-orange-600", icon: RefreshCcw },
  REFUNDED: { label: "Refunded", className: "text-gray-600", icon: RefreshCcw },
}

export function PaymentStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const cfg = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${cfg.className} ${size === "sm" ? "text-xs" : "text-sm"}`}>
      <Icon size={size === "sm" ? 12 : 14} />
      {cfg.label}
    </span>
  )
}
