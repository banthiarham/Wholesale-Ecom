"use client"

import { useEffect, useState } from "react"
import { Search, RotateCcw, X } from "lucide-react"

interface ReturnItem {
  id: string
  orderItemId: string
  quantity: number
  reason: string | null
}

interface ReturnRequest {
  id: string
  orderId: string
  userId: string
  status: string
  reason: string
  notes: string | null
  refundAmount: number | null
  createdAt: string
  user?: { firstName: string; lastName: string; email: string }
  order?: { orderNumber: string }
  items?: ReturnItem[]
}

const statusColor: Record<string, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [filtered, setFiltered] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<ReturnRequest | null>(null)
  const [actionStatus, setActionStatus] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [processing, setProcessing] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadReturns() }, [token])
  useEffect(() => {
    let result = returns
    if (search) { const q = search.toLowerCase(); result = result.filter((r) => r.orderId?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q) || r.user?.firstName?.toLowerCase().includes(q)) }
    if (statusFilter) result = result.filter((r) => r.status === statusFilter)
    setFiltered(result)
  }, [returns, search, statusFilter])

  const loadReturns = async () => {
    setLoading(true)
    try { const res = await fetch("/api/returns", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setReturns(Array.isArray(data) ? data : data.returns ?? []) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const updateStatus = async () => {
    if (!selected || !actionStatus) return
    setProcessing(true)
    const t = localStorage.getItem("token")!
    const body: any = { status: actionStatus }
    if (refundAmount && (actionStatus === "APPROVED" || actionStatus === "COMPLETED")) body.refundAmount = Number(refundAmount)
    try {
      const res = await fetch(`/api/returns/${selected.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) })
      if (res.ok) { setSelected(null); setActionStatus(""); setRefundAmount(""); loadReturns() } else { alert("Failed to update status") }
    } catch (e) { console.error(e); alert("Failed to update status") } finally { setProcessing(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Returns</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Statuses</option><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="PROCESSING">Processing</option><option value="COMPLETED">Completed</option></select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><RotateCcw size={48} className="text-gray-300 mx-auto mb-4" /><p className="text-gray-600">No returns found.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Order</th><th className="px-4 py-3 text-left font-medium text-gray-600">Buyer</th><th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th><th className="px-4 py-3 text-left font-medium text-gray-600">Status</th><th className="px-4 py-3 text-left font-medium text-gray-600">Date</th><th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.order?.orderNumber || r.orderId?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.user?.firstName} {r.user?.lastName}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[r.status] || "bg-gray-100 text-gray-700"}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => { setSelected(r); setActionStatus(""); setRefundAmount("") }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">Return Request</h3><button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Order:</span><span className="font-medium">{selected.order?.orderNumber || selected.orderId?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Buyer:</span><span>{selected.user?.firstName} {selected.user?.lastName}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Status:</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[selected.status] || "bg-gray-100 text-gray-700"}`}>{selected.status}</span></div>
                <div><span className="text-gray-600">Reason:</span> <span>{selected.reason}</span></div>
                {selected.notes && <div><span className="text-gray-600">Notes:</span> <span>{selected.notes}</span></div>}
                {selected.refundAmount && <div className="flex justify-between"><span className="text-gray-600">Refund Amount:</span><span className="font-medium">₹{selected.refundAmount.toLocaleString("en-IN")}</span></div>}
              </div>
              {selected.items && selected.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Items</p>
                  {selected.items.map((item, i) => <div key={i} className="text-sm text-gray-600 py-1 border-b border-gray-50 last:border-0">Quantity: {item.quantity} {item.reason && `— ${item.reason}`}</div>)}
                </div>
              )}
              <div className="border-t border-gray-100 pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label>
                <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select status...</option>
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                  <option value="PROCESSING">Mark Processing</option>
                  <option value="COMPLETED">Mark Completed</option>
                </select>
              </div>
              {(actionStatus === "APPROVED" || actionStatus === "COMPLETED") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount (₹)</label>
                  <input type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Enter refund amount" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={updateStatus} disabled={!actionStatus || processing} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{processing ? "Updating..." : "Update"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}