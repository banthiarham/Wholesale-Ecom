"use client"

import { useEffect, useState } from "react"
import { Search, PackageOpen, X, Paperclip, Loader2, Check, Ban, History as HistoryIcon } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface BulkOrderRequest {
  id: string
  bulkOrderNumber: string
  status: string
  companyName: string
  contactPerson: string
  mobileNumber: string
  email: string
  gstNumber: string | null
  businessAddress: string
  products: string
  quantity: string
  budget: string
  expectedDeliveryDate: string
  message: string
  attachmentUrl: string | null
  adminComment: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string; companyName: string | null } | null
  product: { id: string; title: string; handle: string; thumbnail: string | null; sku: string | null } | null
}

interface StatusHistoryEntry {
  id: string
  status: string
  comment: string | null
  changedBy: string | null
  createdAt: string
}

const STATUS_OPTIONS = ["PENDING", "ACCEPTED", "REJECTED"] as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
}

// The buyer-facing request form only ever collects `products` as a single free-text line
// (see bulk-orders/request/page.tsx), so commas inside it are commonly part of one product's
// description (e.g. "Cotton T-Shirts, assorted sizes") rather than a separator between
// distinct products. Splitting on newline/semicolon only avoids breaking that up, while
// still correctly expanding into multiple rows the moment multi-line input is ever entered.
function getProductRows(r: BulkOrderRequest): { name: string; sku: string | null }[] {
  const parts = r.products.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean)
  const names = parts.length ? parts : [r.products.trim()]

  if (!r.product) return names.map((name) => ({ name, sku: null }))

  // A linked catalog product has a real SKU — attribute it to the matching line if we can
  // find one, otherwise (most common case: a single free-text line) to the only row.
  if (names.length === 1) return [{ name: r.product.title, sku: r.product.sku }]
  const matchIndex = names.findIndex((n) => n.toLowerCase() === r.product!.title.toLowerCase())
  return names.map((name, i) => (i === matchIndex ? { name: r.product!.title, sku: r.product!.sku } : { name, sku: null }))
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export default function AdminBulkOrdersPage() {
  const [requests, setRequests] = useState<BulkOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<BulkOrderRequest | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [commentDraft, setCommentDraft] = useState("")
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const load = () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (search) params.set("search", search)
    fetch(`/api/bulk-orders?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRequests(data.bulkOrders || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  const decide = async (id: string, status: "ACCEPTED" | "REJECTED", comment: string) => {
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/bulk-orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, comment: comment.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        const adminComment = comment.trim() || null
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, adminComment } : r)))
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status, adminComment } : prev))
        loadHistory(id)
      } else {
        alert(data.message || "Could not update status")
      }
    } catch (e) {
      console.error(e)
      alert("Something went wrong")
    } finally {
      setSavingStatus(false)
    }
  }

  const loadHistory = (id: string) => {
    if (!token) return
    setHistoryLoading(true)
    fetch(`/api/bulk-orders/${id}/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setHistory(data.history || []))
      .catch(console.error)
      .finally(() => setHistoryLoading(false))
  }

  const openDetail = (r: BulkOrderRequest) => {
    setSelected(r)
    setCommentDraft(r.adminComment || "")
    setHistory([])
    loadHistory(r.id)
  }

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = requests.filter((r) => r.status === s).length
    return acc
  }, {} as Record<string, number>)

  if (loading && requests.length === 0) {
    return <SkeletonTable />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bulk Orders</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quotation requests from B2B buyers — kept separate from regular checkout orders.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={`text-left bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-3.5 transition-all ${statusFilter === s ? "border-primary-400 ring-2 ring-primary-100 dark:ring-primary-900/40" : "border-gray-100 dark:border-gray-800 hover:border-gray-200"}`}
          >
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide truncate">{STATUS_LABELS[s]}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{counts[s]}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by request #, company, contact, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <PackageOpen size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No bulk order requests found.</p>
        </div>
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Request ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Buyer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Products</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Budget</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.bulkOrderNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900 dark:text-gray-100">{r.contactPerson}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">{r.companyName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{r.products}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{r.quantity}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{r.budget}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-3xl shadow-xl max-h-[85vh] overflow-y-auto animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.bulkOrderNumber}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Submitted {new Date(selected.createdAt).toLocaleString("en-IN")}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
            </div>

            {/* Decision */}
            <div className="mb-6 p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status] || "bg-gray-100 text-gray-700"}`}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
                {savingStatus && <Loader2 size={16} className="animate-spin text-gray-400" />}
              </div>

              {selected.status === "PENDING" ? (
                <>
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    disabled={savingStatus}
                    placeholder="Add a comment for the buyer (optional)..."
                    rows={2}
                    maxLength={1000}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(selected.id, "ACCEPTED", commentDraft)}
                      disabled={savingStatus}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Check size={15} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(selected.id, "REJECTED", commentDraft)}
                      disabled={savingStatus}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <Ban size={15} /> Reject
                    </button>
                  </div>
                </>
              ) : (
                selected.adminComment && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Your comment: </span>
                    {selected.adminComment}
                  </p>
                )
              )}
            </div>

            {/* Order details — plain key/value table per field, matching the rest of the
                Admin Panel's table styling instead of the old scattered icon-card grid. */}
            <div className="mb-5 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow label="Bulk Order ID">{selected.bulkOrderNumber}</InfoRow>
                  <InfoRow label="Submitted Date &amp; Time">{new Date(selected.createdAt).toLocaleString("en-IN")}</InfoRow>
                  <InfoRow label="Status">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status] || "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[selected.status] || selected.status}
                    </span>
                  </InfoRow>
                  <InfoRow label="Company Name">
                    {selected.companyName}
                    {selected.gstNumber && <span className="text-gray-400 dark:text-gray-500"> &middot; GST: {selected.gstNumber}</span>}
                  </InfoRow>
                  <InfoRow label="Contact Person">{selected.contactPerson}</InfoRow>
                  <InfoRow label="Email">{selected.email}</InfoRow>
                  <InfoRow label="Mobile Number">{selected.mobileNumber}</InfoRow>
                  <InfoRow label="Business Address">{selected.businessAddress}</InfoRow>
                  <InfoRow label="Expected Budget">{selected.budget}</InfoRow>
                  <InfoRow label="Expected Delivery Date">{new Date(selected.expectedDeliveryDate).toLocaleDateString("en-IN")}</InfoRow>
                  <InfoRow label="Buyer Comment">{selected.message || "—"}</InfoRow>
                </tbody>
              </table>
            </div>

            {/* Product line items — each product the buyer listed gets its own row. */}
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Product Details</p>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Product Name</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">SKU</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Requested Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {getProductRows(selected).map((p, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">{p.sku || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{selected.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {getProductRows(selected).length > 1 && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Requested quantity reflects the total for the full order, not per product.</p>
              )}
            </div>

            {selected.attachmentUrl && (
              <a
                href={selected.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                <Paperclip size={14} /> View attachment
              </a>
            )}

            {selected.user && (
              <p className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                Submitted by registered user: {selected.user.firstName} {selected.user.lastName} ({selected.user.email})
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
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
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${STATUS_COLORS[h.status] || "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[h.status] || h.status}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {new Date(h.createdAt).toLocaleString("en-IN")}
                        {h.comment && <span className="block text-gray-700 dark:text-gray-300 mt-0.5">{h.comment}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="w-36 sm:w-48 px-4 py-2.5 text-left align-top font-medium text-gray-500 dark:text-gray-400 bg-gray-50/60 dark:bg-gray-800/40 whitespace-nowrap">
        {label}
      </th>
      <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 break-words">{children}</td>
    </tr>
  )
}
