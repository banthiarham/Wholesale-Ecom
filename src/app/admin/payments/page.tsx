"use client"

import { useEffect, useState } from "react"
import { Search, CreditCard, Eye, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"

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
  createdAt: string
  updatedAt: string
}

const PROVIDER_LABELS: Record<string, string> = {
  CCAVENUE: "CCAvenue",
  RAZORPAY: "Razorpay",
  STRIPE: "Stripe",
  PAYU: "PayU",
  COD: "Cash on Delivery",
}

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  AUTHORIZED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CAPTURED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REFUNDED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const orderStatusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PROCESSING: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SHIPPED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadPayments() }, [token])

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

  const openDetail = (payment: Payment) => {
    setSelected(payment)
    setVerifyStatus("")
    setProviderRef(payment.providerRef || "")
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
      } else { alert("Failed to verify payment") }
    } catch (e) { alert("Failed to verify payment") } finally { setVerifying(false) }
  }

  // Get unique providers for filter dropdown
  const providers = Array.from(new Set(payments.map((p) => p.provider))).sort()

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
          <div key={card.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{card.count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatPrice(card.amount)}</p>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <CreditCard size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No payments found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
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
              {filtered.map((p) => (
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
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${orderStatusColor[p.order?.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {p.order?.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[p.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {p.status}
                    </span>
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
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[selected.status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{selected.status}</span>
                </div>
                {selected.providerRef && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Ref:</span><span className="font-mono text-xs">{selected.providerRef}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Order Status:</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${orderStatusColor[selected.order?.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>{selected.order?.status}</span></div>
              </div>
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