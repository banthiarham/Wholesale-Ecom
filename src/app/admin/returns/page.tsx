"use client"

import { useEffect, useState } from "react"
import { Search, RotateCcw, X, History as HistoryIcon, Ticket, Clock, CheckCircle, Activity } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { AdminStatusBadge, type AdminBadgeVariant } from "@/lib/adminStatusBadge"

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
  type: string
  reason: string
  notes: string | null
  adminRemarks: string | null
  refundAmount: number | null
  createdAt: string
  user?: { firstName: string; lastName: string; email: string }
  order?: { orderNumber: string }
  items?: ReturnItem[]
  rmaTicket?: RmaTicket | null
}

interface TicketActivityEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  note: string | null
  createdAt: string
  changedBy?: { firstName: string; lastName: string } | null
}

interface RmaTicket {
  id: string
  ticketNumber: string
  priority: string
  status: string
  openedAt: string
  closedAt: string | null
  resolutionTimeMinutes: number | null
  assignedToId?: string | null
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null
  activities?: TicketActivityEntry[]
}

interface TicketKpis { totalTickets: number; openTickets: number; closedTickets: number; resolutionRate: number; averageResolutionTimeMinutes: number }
interface StaffUser { id: string; firstName: string; lastName: string; email: string; role: string }

interface ReturnStatusHistoryEntry {
  id: string
  status: string
  remarks: string | null
  changedBy: string | null
  createdAt: string
}

function returnStatusBadgeProps(status: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
  switch (status) {
    case "REQUESTED": return { variant: "warning" }
    case "APPROVED": return { variant: "primary" }
    case "REJECTED": return { variant: "danger" }
    case "PROCESSING": return { colorClassName: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" }
    case "COMPLETED": return { variant: "success" }
    default: return { variant: "neutral" }
  }
}

function returnTypeBadgeProps(type: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
  return type === "REPLACEMENT"
    ? { colorClassName: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
    : { variant: "neutral" }
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [filtered, setFiltered] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [selected, setSelected] = useState<ReturnRequest | null>(null)
  const [actionStatus, setActionStatus] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [remarksDraft, setRemarksDraft] = useState("")
  const [processing, setProcessing] = useState(false)
  const [history, setHistory] = useState<ReturnStatusHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [ticket, setTicket] = useState<RmaTicket | null>(null)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketSaving, setTicketSaving] = useState(false)
  const [ticketStatus, setTicketStatus] = useState("")
  const [ticketPriority, setTicketPriority] = useState("")
  const [ticketAssignee, setTicketAssignee] = useState("")
  const [ticketNote, setTicketNote] = useState("")
  const [ticketKpis, setTicketKpis] = useState<TicketKpis>({ totalTickets: 0, openTickets: 0, closedTickets: 0, resolutionRate: 0, averageResolutionTimeMinutes: 0 })
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadReturns(); loadTicketKpis(); loadStaffUsers() }, [token])
  useEffect(() => {
    let result = returns
    if (search) { const q = search.toLowerCase(); result = result.filter((r) => r.orderId?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q) || r.user?.firstName?.toLowerCase().includes(q)) }
    if (statusFilter) result = result.filter((r) => r.status === statusFilter)
    if (typeFilter) result = result.filter((r) => r.type === typeFilter)
    setFiltered(result)
  }, [returns, search, statusFilter, typeFilter])

  const loadReturns = async () => {
    setLoading(true)
    try { const res = await fetch("/api/returns", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setReturns(Array.isArray(data) ? data : data.returns ?? []) } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadTicketKpis = async () => {
    try { const res = await fetch("/api/rma-tickets/kpis", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setTicketKpis(await res.json()) } catch (e) { console.error(e) }
  }

  const loadStaffUsers = async () => {
    try { const res = await fetch("/api/users?take=100", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setStaffUsers((data.users || []).filter((user: StaffUser) => user.role === "ADMIN" || user.role === "VENDOR")) } catch (e) { console.error(e) }
  }

  const loadTicket = async (returnRequestId: string) => {
    setTicketLoading(true)
    try {
      const res = await fetch(`/api/rma-tickets/return/${returnRequestId}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = res.ok ? await res.json() : null
      setTicket(data)
      setTicketStatus(data?.status || "")
      setTicketPriority(data?.priority || "NORMAL")
      setTicketAssignee(data?.assignedToId || "")
      setTicketNote("")
    } catch (e) { console.error(e); setTicket(null) } finally { setTicketLoading(false) }
  }

  const updateTicket = async () => {
    if (!ticket) return
    setTicketSaving(true)
    try {
      const res = await fetch(`/api/rma-tickets/${ticket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: ticketStatus, priority: ticketPriority, assignedToId: ticketAssignee || null, note: ticketNote.trim() || undefined }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Failed to update ticket")
      setTicket(data)
      setTicketNote("")
      loadTicketKpis()
      loadReturns()
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to update ticket") } finally { setTicketSaving(false) }
  }

  const updateStatus = async () => {
    if (!selected || !actionStatus) return
    setProcessing(true)
    const t = localStorage.getItem("token")!
    const body: any = { status: actionStatus, remarks: remarksDraft.trim() || undefined }
    if (refundAmount && (actionStatus === "APPROVED" || actionStatus === "COMPLETED")) body.refundAmount = Number(refundAmount)
    try {
      const res = await fetch(`/api/returns/${selected.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) })
      if (res.ok) { setSelected(null); setActionStatus(""); setRefundAmount(""); setRemarksDraft(""); setTicket(null); loadReturns(); loadTicketKpis() } else { alert("Failed to update status") }
    } catch (e) { console.error(e); alert("Failed to update status") } finally { setProcessing(false) }
  }

  const loadHistory = (id: string) => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : ""
    if (!t) return
    setHistoryLoading(true)
    fetch(`/api/returns/${id}/history`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => setHistory(data.history || []))
      .catch(console.error)
      .finally(() => setHistoryLoading(false))
  }

  const openReview = (r: ReturnRequest) => {
    setSelected(r)
    setActionStatus("")
    setRefundAmount("")
    setRemarksDraft(r.adminRemarks || "")
    setHistory([])
    loadHistory(r.id)
    setTicket(r.rmaTicket || null)
    loadTicket(r.id)
  }

  if (loading) return <SkeletonTable rows={6} cols={6} />

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Returns & RMA Tickets</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Return and replacement workflow with linked ticket tracking.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Tickets", value: ticketKpis.totalTickets, icon: Ticket, color: "text-primary-600" },
          { label: "Open Tickets", value: ticketKpis.openTickets, icon: Activity, color: "text-amber-600" },
          { label: "Closed Tickets", value: ticketKpis.closedTickets, icon: CheckCircle, color: "text-green-600" },
          { label: "Resolution Rate", value: `${ticketKpis.resolutionRate}%`, icon: CheckCircle, color: "text-cyan-600" },
          { label: "Avg. Resolution", value: formatResolution(ticketKpis.averageResolutionTimeMinutes), icon: Clock, color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => <div key={label} className="admin-card-static p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p></div><Icon size={22} className={color} /></div></div>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" /><input type="text" placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Types</option><option value="RETURN">Return</option><option value="REPLACEMENT">Replacement</option></select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">All Statuses</option><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="PROCESSING">Processing</option><option value="COMPLETED">Completed</option></select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center"><RotateCcw size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" /><p className="text-gray-600 dark:text-gray-400">No returns found.</p></div>
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Order</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Buyer</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reason</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.order?.orderNumber || r.orderId?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.user?.firstName} {r.user?.lastName}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={r.type === "REPLACEMENT" ? "Replacement" : "Return"} {...returnTypeBadgeProps(r.type)} /></td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={r.status} {...returnStatusBadgeProps(r.status)} /></td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openReview(r)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition dark:text-gray-300">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.type === "REPLACEMENT" ? "Replacement Request" : "Return Request"}</h3><button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button></div>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Order:</span><span className="font-medium dark:text-gray-100">{selected.order?.orderNumber || selected.orderId?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Buyer:</span><span className="dark:text-gray-200">{selected.user?.firstName} {selected.user?.lastName}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Type:</span><AdminStatusBadge status={selected.type === "REPLACEMENT" ? "Replacement" : "Return"} {...returnTypeBadgeProps(selected.type)} /></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Status:</span><AdminStatusBadge status={selected.status} {...returnStatusBadgeProps(selected.status)} /></div>
                <div><span className="text-gray-600 dark:text-gray-400">Reason:</span> <span className="dark:text-gray-200">{selected.reason}</span></div>
                {selected.notes && <div><span className="text-gray-600 dark:text-gray-400">Notes:</span> <span className="dark:text-gray-200">{selected.notes}</span></div>}
                {selected.adminRemarks && <div><span className="text-gray-600 dark:text-gray-400">Admin remarks:</span> <span className="dark:text-gray-200">{selected.adminRemarks}</span></div>}
                {selected.type !== "REPLACEMENT" && selected.refundAmount && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Refund Amount:</span><span className="font-medium dark:text-gray-100">₹{selected.refundAmount.toLocaleString("en-IN")}</span></div>}
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><Ticket size={16} className="text-primary-600" /> RMA Ticket</p>
                {ticketLoading ? (
                  <p className="text-xs text-gray-400">Loading ticket...</p>
                ) : !ticket ? (
                  <p className="text-xs text-amber-600">No linked ticket found. Existing records receive tickets when the RMA migration is applied.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-primary-50/60 p-3 text-sm dark:bg-primary-900/20">
                      <div><span className="block text-xs text-gray-500">Ticket Number</span><span className="font-semibold text-primary-700 dark:text-primary-300">{ticket.ticketNumber}</span></div>
                      <div><span className="block text-xs text-gray-500">Status</span><AdminStatusBadge status={ticket.status.replace(/_/g, " ")} {...ticketStatusBadgeProps(ticket.status)} /></div>
                      <div><span className="block text-xs text-gray-500">Priority</span><span className="dark:text-gray-200">{ticket.priority}</span></div>
                      <div><span className="block text-xs text-gray-500">Assigned To</span><span className="dark:text-gray-200">{ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : "Unassigned"}</span></div>
                      <div><span className="block text-xs text-gray-500">Opened At</span><span className="dark:text-gray-200">{new Date(ticket.openedAt).toLocaleString("en-IN")}</span></div>
                      <div><span className="block text-xs text-gray-500">Closed At</span><span className="dark:text-gray-200">{ticket.closedAt ? new Date(ticket.closedAt).toLocaleString("en-IN") : "—"}</span></div>
                      <div><span className="block text-xs text-gray-500">Resolution Time</span><span className="dark:text-gray-200">{formatResolution(ticket.resolutionTimeMinutes)}</span></div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option><option value="CANCELLED">Cancelled</option>{selected.status === "COMPLETED" && <option value="CLOSED">Closed</option>}</select>
                      <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
                      <select value={ticketAssignee} onChange={(e) => setTicketAssignee(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><option value="">Unassigned</option>{staffUsers.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}</select>
                    </div>
                    <textarea value={ticketNote} onChange={(e) => setTicketNote(e.target.value)} rows={2} placeholder="Activity note for status change (optional)" className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    <button onClick={updateTicket} disabled={ticketSaving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{ticketSaving ? "Saving..." : "Update Ticket"}</button>
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><HistoryIcon size={12} /> Ticket Activity</p>
                      {!ticket.activities?.length ? <p className="text-xs text-gray-400">No ticket activity yet.</p> : <ul className="space-y-2">{ticket.activities.map((entry) => <li key={entry.id} className="flex items-start gap-2 text-xs"><AdminStatusBadge status={entry.toStatus.replace(/_/g, " ")} {...ticketStatusBadgeProps(entry.toStatus)} /><span className="text-gray-500 dark:text-gray-400">{new Date(entry.createdAt).toLocaleString("en-IN")}{entry.changedBy && ` · ${entry.changedBy.firstName} ${entry.changedBy.lastName}`}{entry.note && <span className="mt-0.5 block text-gray-700 dark:text-gray-300">{entry.note}</span>}</span></li>)}</ul>}
                    </div>
                  </div>
                )}
              </div>
              {selected.items && selected.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Items</p>
                  {selected.items.map((item, i) => <div key={i} className="text-sm text-gray-600 dark:text-gray-400 py-1 border-b border-gray-50 dark:border-gray-800 last:border-0">Quantity: {item.quantity} {item.reason && `— ${item.reason}`}</div>)}
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Update Status</label>
                <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select status...</option>
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                  <option value="PROCESSING">{selected.type === "REPLACEMENT" ? "Mark Replacement Shipped" : "Mark Processing"}</option>
                  <option value="COMPLETED">{selected.type === "REPLACEMENT" ? "Mark Replacement Delivered" : "Mark Completed"}</option>
                </select>
              </div>
              {selected.type !== "REPLACEMENT" && (actionStatus === "APPROVED" || actionStatus === "COMPLETED") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refund Amount (₹)</label>
                  <input type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Enter refund amount" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks (visible to buyer)</label>
                <textarea value={remarksDraft} onChange={(e) => setRemarksDraft(e.target.value)} rows={2} maxLength={1000} placeholder="Add a note explaining the decision (optional)..." className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:text-gray-200">Cancel</button>
                <button onClick={updateStatus} disabled={!actionStatus || processing} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{processing ? "Updating..." : "Update"}</button>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  <HistoryIcon size={12} /> Status History
                </p>
                {historyLoading ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Loading...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">No status changes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li key={h.id} className="text-xs flex items-start gap-2">
                        <AdminStatusBadge status={h.status} {...returnStatusBadgeProps(h.status)} />
                        <span className="text-gray-500 dark:text-gray-400">
                          {new Date(h.createdAt).toLocaleString("en-IN")}
                          {h.remarks && <span className="block text-gray-700 dark:text-gray-300 mt-0.5">{h.remarks}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ticketStatusBadgeProps(status: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
  switch (status) {
    case "OPEN": return { variant: "warning" }
    case "PENDING": return { colorClassName: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
    case "IN_PROGRESS": return { variant: "primary" }
    case "RESOLVED": return { colorClassName: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" }
    case "CLOSED": return { variant: "success" }
    case "CANCELLED": return { variant: "danger" }
    default: return { variant: "neutral" }
  }
}

function formatResolution(minutes: number | null | undefined) {
  if (minutes == null) return "—"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
