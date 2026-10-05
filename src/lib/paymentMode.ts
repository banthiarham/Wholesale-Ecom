/**
 * Human-readable payment mode for an order. Orders paid online have a Payment row whose
 * `provider` is the gateway; Cash on Delivery orders have no Payment row at all, so a missing
 * payment means COD (same convention the customer's order page already uses).
 */
const MODE_LABELS: Record<string, string> = {
  COD: "Cash on Delivery (COD)",
  CCAVENUE: "CCAvenue",
  RAZORPAY: "Razorpay",
  WALLET: "Wallet",
  PAYU: "PayU",
  STRIPE: "Stripe",
}

export function paymentModeLabel(provider?: string | null): string {
  const key = (provider || "COD").toUpperCase()
  return MODE_LABELS[key] ?? provider ?? "Cash on Delivery (COD)"
}

/** Payment status values an order can have, used by the admin payment-status filter. */
export const PAYMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "AUTHORIZED", label: "Authorized" },
  { value: "CAPTURED", label: "Paid (Captured)" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUND_PENDING", label: "Refund Pending" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CANCELLED", label: "Cancelled" },
]
