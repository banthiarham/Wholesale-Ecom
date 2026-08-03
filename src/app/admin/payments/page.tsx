"use client"

import { useEffect, useState } from "react"
import { Search, CreditCard, Eye, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { AdminStatusBadge, type AdminBadgeVariant } from "@/lib/adminStatusBadge"

interface PaymentGateway {
  id: string
  provider: string
  label: string
}

interface OrderInfo {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string } | null
}

interface Payment {
  id: string
  orderId: string
  provider: string
  providerRef: string | null
  amount: number
  currency: string
  status: string
  gatewayId: string | null
  gateway: PaymentGateway | null
  order: OrderInfo
  metadata: any
  createdAt: string
  updatedAt: string
}

interface PaymentStats {
  totalPayments: number
  totalAmount: number
  successfulPayments: number
  successfulAmount: number
  pendingPayments: number
  pendingAmount: number
  failedPayments: number
  failedAmount: number
  refundedPayments: number
  refundedAmount: number
  todayRevenue: number
  monthRevenue: number
  successRate: number
}

interface Refund {
  id: string
  razorpayRefundId: string | null
  amount: number
  isPartial: boolean
  reason: string | null
  status: string
  createdAt: string
}

const PAGE_SIZE = 20

const PROVIDER_LABELS: Record<string, string> = {
  CCAVENUE: "CCAvenue",
  RAZORPAY: "Razorpay",
  STRIPE: "Stripe",
  PAYU: "PayU",
  COD: "Cash on Delivery",
}

function paymentStatusBadgeProps(status: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
  switch (status) {
    case "PENDING": return { variant: "warning" }
    case "AUTHORIZED": return { variant: "primary" }
    case "CAPTURED": return { variant: "success" }
    case "FAILED": return { variant: "danger" }
    case "REFUNDED": return { colorClassName: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }
    case "CANCELLED": return { variant: "neutral" }
    default: return { variant: "neutral" }
  }
}

function orderStatusBadgeProps(status: string | undefined): { variant?: AdminBadgeVariant; colorClassName?: string } {
  switch (status) {
    case "PENDING": return { variant: "warning" }
    case "CONFIRMED": return { variant: "primary" }
    case "PROCESSING": return { colorClassName: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" }
    case "SHIPPED": return { colorClassName: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" }
    case "DELIVERED": return { variant: "success" }
    case "CANCELLED": return { variant: "danger" }
    default: return { variant: "neutral" }
  }
}

const providerColor: Record<string, string> = {
  CCAVENUE: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  RAZORPAY: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  STRIPE: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  PAYU: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  COD: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filtered, setFiltered] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [selected, setSelected] = useState<Payment | null>(null)
  const [verifyStatus, setVerifyStatus] = useState("")
  const [providerRef, setProviderRef] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [page, setPage] = useState(1)
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loadingRefunds, setLoadingRefunds] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [refunding, setRefunding] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadPayments(); loadStats() }, [token])
  useEffect(() => { setPage(1) }, [search, statusFilter, providerFilter])

  useEffect(() => {
    let result = payments
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.order?.orderNumber?.toLowerCase().includes(q) ||
          p.order?.user?.email?.toLowerCase().includes(q) ||
          p.order?.user?.firstName?.toLowerCase().includes(q) ||
          p.order?.user?.lastName?.toLowerCase().includes(q) ||
          p.provider?.toLowerCase().includes(q) ||
          p.providerRef?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter((p) => p.status === statusFilter)
    if (providerFilter) result = result.filter((p) => p.provider === providerFilter)
    setFiltered(result)
  }, [payments, search, statusFilter, providerFilter])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/payments", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPayments(data.payments ?? [])
      setFiltered(data.payments ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadStats = async () => {
    try {
      const res = await fetch("/api/payments/stats/summary", { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setStats(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadRefunds = async (orderId: string) => {
    setLoadingRefunds(true)
    try {
      const res = await fetch(`/api/payments/${orderId}/refunds`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setRefunds(data.refunds ?? [])
    } catch (e) { console.error(e) } finally { setLoadingRefunds(false) }
  }

  const openDetail = (payment: Payment) => {
    setSelected(payment)
    setVerifyStatus("")
    setProviderRef(payment.providerRef || "")
    setRefundAmount("")
    setRefundReason("")
    setRefunds([])
    if (payment.provider === "RAZORPAY" && payment.status === "CAPTURED") {
      loadRefunds(payment.orderId)
    }
  }

  const alreadyRefunded = refunds.filter((r) => r.status === "PROCESSED").reduce((s, r) => s + Number(r.amount), 0)
  const remainingRefundable = selected ? Number(selected.amount) - alreadyRefunded : 0

  const submitRefund = async (full: boolean) => {
    if (!selected) return
    const amount = full ? undefined : Number(refundAmount)
    if (!full && (!amount || amount <= 0 || amount > remainingRefundable)) {
      alert(`Enter a refund amount between 0 and ${remainingRefundable.toFixed(2)}`)
      return
    }
    if (!confirm(full ? "Issue a full refund for this payment?" : `Issue a partial refund of ${amount}?`)) return
    setRefunding(true)
    try {
      const res = await fetch(`/api/payments/${selected.orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, reason: refundReason || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setRefundAmount("")
        setRefundReason("")
        await loadRefunds(selected.orderId)
        await loadPayments()
        await loadStats()
      } else {
        alert(data.message || "Failed to process refund")
      }
    } catch (e) {
      alert("Failed to process refund")
    } finally {
      setRefunding(false)
    }
  }

  const verifyPayment = async () => {
    if (!selected || !verifyStatus) return
    setVerifying(true)
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(`/api/payments/${selected.orderId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ providerRef: providerRef || undefined, status: verifyStatus }),
      })
      if (res.ok) {
        setSelected(null)
        setVerifyStatus("")
        setProviderRef("")
        loadPayments()
        loadStats()
      } else { alert("Failed to verify payment") }
    } catch (e) { alert("Failed to verify payment") } finally { setVerifying(false) }
  }

  // Get unique providers for filter dropdown
  const providers = Array.from(new Set(payments.map((p) => p.provider))).sort()
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) return <SkeletonTable />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Payments</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by order, email, provider, or ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="AUTHORIZED">Authorized</option>
          <option value="CAPTURED">Captured</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", count: payments.length, amount: payments.reduce((s, p) => s + Number(p.amount), 0) },
          { label: "Captured", count: payments.filter((p) => p.status === "CAPTURED").length, amount: payments.filter((p) => p.status === "CAPTURED").reduce((s, p) => s + Number(p.amount), 0) },
          { label: "Pending", count: payments.filter((p) => p.status === "PENDING").length, amount: payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + Number(p.amount), 0) },
          { label: "Failed", count: payments.filter((p) => p.status === "FAILED").length, amount: payments.filter((p) => p.status === "FAILED").reduce((s, p) => s + Number(p.amount), 0) },
        ].map((card) => (
          <div key={card.label} className="admin-card-static p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{card.count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatPrice(card.amount)}</p>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Refunded", value: stats.refundedPayments, sub: formatPrice(stats.refundedAmount) },
            { label: "Today's Revenue", value: formatPrice(stats.todayRevenue), sub: "" },
            { label: "Monthly Revenue", value: formatPrice(stats.monthRevenue), sub: "" },
            { label: "Success Rate", value: `${stats.successRate}%`, sub: `${stats.successfulPayments}/${stats.totalPayments}` },
          ].map((card) => (
            <div key={card.label} className="admin-card-static p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
              {card.sub && <p className="text-xs text-gray-500 dark:text-gray-400">{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <CreditCard size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No payments found.</p>
        </div>
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Order</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Order Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Payment Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {paginated.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">#{p.order?.orderNumber?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.order?.user ? (
                      <>
                        {p.order.user.firstName} {p.order.user.lastName}
                        <br />
                        <span className="text-xs text-gray-400 dark:text-gray-500">{p.order.user.email}</span>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatPrice(Number(p.amount))}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${providerColor[p.provider] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {PROVIDER_LABELS[p.provider] || p.provider}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={p.order?.status ?? ""} {...orderStatusBadgeProps(p.order?.status)} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={p.status} {...paymentStatusBadgeProps(p.status)} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {p.providerRef ? (p.providerRef.length > 12 ? `${p.providerRef.slice(0, 12)}...` : p.providerRef) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDetail(p)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages} ({filtered.length} payments)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment Details</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Order:</span><span className="font-medium">#{selected.order?.orderNumber?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Customer:</span><span>{selected.order?.user ? `${selected.order.user.firstName} ${selected.order.user.lastName}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Email:</span><span className="text-xs">{selected.order?.user?.email || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Amount:</span><span className="font-medium">{formatPrice(Number(selected.amount))}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Provider:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${providerColor[selected.provider] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {PROVIDER_LABELS[selected.provider] || selected.provider}
                  </span>
                </div>
                {selected.gateway && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Gateway:</span><span className="text-xs">{selected.gateway.label}</span></div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <AdminStatusBadge status={selected.status} {...paymentStatusBadgeProps(selected.status)} />
                </div>
                {selected.providerRef && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Ref:</span><span className="font-mono text-xs">{selected.providerRef}</span></div>
                )}
                {selected.metadata?.razorpayOrderId && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Razorpay Order ID:</span><span className="font-mono text-xs">{selected.metadata.razorpayOrderId}</span></div>
                )}
                {selected.metadata?.razorpayPaymentId && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Razorpay Payment ID:</span><span className="font-mono text-xs">{selected.metadata.razorpayPaymentId}</span></div>
                )}
                {selected.metadata?.verifiedAt && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Verified At:</span><span className="text-xs">{new Date(selected.metadata.verifiedAt).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Order Status:</span><AdminStatusBadge status={selected.order?.status ?? ""} {...orderStatusBadgeProps(selected.order?.status)} /></div>
              </div>

              {selected.provider === "RAZORPAY" && selected.status === "CAPTURED" && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Refund</p>
                  {loadingRefunds ? (
                    <p className="text-xs text-gray-400">Loading refund history...</p>
                  ) : (
                    <>
                      {refunds.length > 0 && (
                        <div className="mb-3 space-y-1.5 max-h-28 overflow-y-auto">
                          {refunds.map((r) => (
                            <div key={r.id} className="flex justify-between text-xs bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1.5">
                              <span>{formatPrice(Number(r.amount))} {r.isPartial ? "(partial)" : "(full)"}</span>
                              <span className={r.status === "PROCESSED" ? "text-green-600" : r.status === "FAILED" ? "text-red-600" : "text-yellow-600"}>{r.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {remainingRefundable > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Refundable balance: {formatPrice(remainingRefundable)}</p>
                          <input
                            type="number"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder={`Amount (max ${remainingRefundable.toFixed(2)})`}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <input
                            type="text"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitRefund(false)}
                              disabled={refunding || !refundAmount}
                              className="flex-1 py-2 border border-primary-600 text-primary-600 rounded-lg text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50"
                            >
                              {refunding ? "Processing..." : "Partial Refund"}
                            </button>
                            <button
                              onClick={() => submitRefund(true)}
                              disabled={refunding}
                              className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                            >
                              {refunding ? "Processing..." : "Full Refund"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">This payment has been fully refunded.</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Verify / Update Payment</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">New Status</label>
                    <select
                      value={verifyStatus}
                      onChange={(e) => setVerifyStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select status...</option>
                      <option value="AUTHORIZED">Authorized</option>
                      <option value="CAPTURED">Captured</option>
                      <option value="FAILED">Failed</option>
                      <option value="REFUNDED">Refunded</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Provider Reference (optional)</label>
                    <input
                      type="text"
                      value={providerRef}
                      onChange={(e) => setProviderRef(e.target.value)}
                      placeholder="Payment reference ID"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={verifyPayment}
                    disabled={!verifyStatus || verifying}
                    className="w-full py-2.5 bg-primary-600 dark:bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 dark:hover:bg-primary-700 disabled:opacity-50"
                  >
                    {verifying ? "Updating..." : "Update Payment Status"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}