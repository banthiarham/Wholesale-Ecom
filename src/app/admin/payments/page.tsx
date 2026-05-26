"use client"

import { useEffect, useState } from "react"
import { Search, CreditCard, Eye, X } from "lucide-react"

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  user?: { firstName: string; lastName: string; email: string }
  payment?: { id: string; provider: string; providerRef: string | null; amount: number; status: string; createdAt: string } | null
}

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  AUTHORIZED: "bg-blue-100 text-blue-700",
  CAPTURED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-gray-100 text-gray-700",
}

const orderStatusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filtered, setFiltered] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<Order | null>(null)
  const [paymentDetail, setPaymentDetail] = useState<any>(null)
  const [verifyStatus, setVerifyStatus] = useState("")
  const [providerRef, setProviderRef] = useState("")
  const [verifying, setVerifying] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadOrders() }, [token])
  useEffect(() => {
    let result = orders
    if (search) { const q = search.toLowerCase(); result = result.filter((o) => o.orderNumber?.toLowerCase().includes(q) || o.user?.email?.toLowerCase().includes(q) || o.user?.firstName?.toLowerCase().includes(q)) }
    if (statusFilter) result = result.filter((o) => o.payment?.status === statusFilter)
    setFiltered(result)
  }, [orders, search, statusFilter])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setOrders(data.orders ?? [])
      setFiltered(data.orders ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadPaymentDetail = async (order: Order) => {
    setSelected(order)
    setPaymentDetail(null)
    try {
      const res = await fetch(`/api/payments/${order.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPaymentDetail(data.payment ?? data)
    } catch (e) { setPaymentDetail({ status: "NO_PAYMENT", amount: order.totalAmount }) }
  }

  const verifyPayment = async () => {
    if (!selected || !verifyStatus) return
    setVerifying(true)
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(`/api/payments/${selected.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ providerRef: providerRef || undefined, status: verifyStatus }),
      })
      if (res.ok) { setSelected(null); setVerifyStatus(""); setProviderRef(""); loadOrders() } else { alert("Failed to verify payment") }
    } catch (e) { alert("Failed to verify payment") } finally { setVerifying(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Payments</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search by order, email, or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Payment Statuses</option><option value="PENDING">Pending</option><option value="AUTHORIZED">Authorized</option><option value="CAPTURED">Captured</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option><option value="CANCELLED">Cancelled</option></select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><CreditCard size={48} className="text-gray-300 mx-auto mb-4" /><p className="text-gray-600">No payments found.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Order</th><th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th><th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th><th className="px-4 py-3 text-left font-medium text-gray-600">Order Status</th><th className="px-4 py-3 text-left font-medium text-gray-600">Payment Status</th><th className="px-4 py-3 text-left font-medium text-gray-600">Date</th><th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">#{order.orderNumber?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600">{order.user?.firstName} {order.user?.lastName}<br /><span className="text-xs text-gray-400">{order.user?.email}</span></td>
                  <td className="px-4 py-3 font-semibold">₹{order.totalAmount?.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${orderStatusColor[order.status] || "bg-gray-100 text-gray-700"}`}>{order.status}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[order.payment?.status || "PENDING"] || "bg-yellow-100 text-yellow-700"}`}>{order.payment?.status || "PENDING"}</span></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => loadPaymentDetail(order)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"><Eye size={14} /> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">Payment Details</h3><button onClick={() => { setSelected(null); setPaymentDetail(null) }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Order:</span><span className="font-medium">#{selected.orderNumber?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Customer:</span><span>{selected.user?.firstName} {selected.user?.lastName}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Amount:</span><span className="font-medium">₹{selected.totalAmount?.toLocaleString("en-IN")}</span></div>
                {paymentDetail && <>
                  <div className="flex justify-between"><span className="text-gray-600">Provider:</span><span>{paymentDetail.provider || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Status:</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[paymentDetail.status] || "bg-gray-100 text-gray-600"}`}>{paymentDetail.status}</span></div>
                  {paymentDetail.providerRef && <div className="flex justify-between"><span className="text-gray-600">Ref:</span><span className="font-mono text-xs">{paymentDetail.providerRef}</span></div>}
                </>}
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Verify / Update Payment</p>
                <div className="space-y-3">
                  <div><label className="block text-xs text-gray-500 mb-1">New Status</label><select value={verifyStatus} onChange={(e) => setVerifyStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select status...</option><option value="AUTHORIZED">Authorized</option><option value="CAPTURED">Captured</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option><option value="CANCELLED">Cancelled</option></select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Provider Reference (optional)</label><input type="text" value={providerRef} onChange={(e) => setProviderRef(e.target.value)} placeholder="Payment reference ID" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
                  <button onClick={verifyPayment} disabled={!verifyStatus || verifying} className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{verifying ? "Updating..." : "Update Payment Status"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}