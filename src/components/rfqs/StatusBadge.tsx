"use client"

import { FileText, Send, Eye, Tag, CheckCircle2, XCircle, Clock } from "lucide-react"

// Consolidates the two near-duplicate inline statusBadge() functions that
// previously lived in rfqs/page.tsx and rfqs/[id]/page.tsx (same pattern as
// src/components/orders/StatusBadge.tsx for the order-lifecycle vocabulary).
const RFQ_STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700", icon: FileText },
  SUBMITTED: { label: "Submitted", className: "bg-primary-50 text-primary-700", icon: Send },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-50 text-amber-700", icon: Eye },
  QUOTED: { label: "Quoted", className: "bg-purple-50 text-purple-700", icon: Tag },
  ACCEPTED: { label: "Accepted", className: "bg-green-50 text-green-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700", icon: XCircle },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-500", icon: Clock },
}

export function RfqStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const cfg = RFQ_STATUS_CONFIG[status] || RFQ_STATUS_CONFIG.DRAFT
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide rounded-full shrink-0 ${cfg.className} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <Icon size={size === "sm" ? 11 : 13} />
      {cfg.label}
    </span>
  )
}

// Distinct vocabulary from RFQ status — a Quote only ever has these three states.
const QUOTE_STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700", icon: Clock },
  ACCEPTED: { label: "Accepted", className: "bg-green-50 text-green-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700", icon: XCircle },
}

export function QuoteStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const cfg = QUOTE_STATUS_CONFIG[status] || QUOTE_STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide rounded-full shrink-0 ${cfg.className} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <Icon size={size === "sm" ? 11 : 13} />
      {cfg.label}
    </span>
  )
}
