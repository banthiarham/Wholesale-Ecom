"use client"

import { useEffect, useState } from "react"
import { Search, PackageOpen, X, Building2, Mail, Phone, MapPin, FileBadge, Package, Layers, Wallet, CalendarDays, MessageSquare, Paperclip, Loader2 } from "lucide-react"
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
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string; companyName: string | null } | null
  product: { id: string; title: string; handle: string; thumbnail: string | null; sku: string | null } | null
}

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUOTATION_SENT", "NEGOTIATION", "CONFIRMED", "CANCELLED"] as const

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUOTATION_SENT: "Quotation Sent",
  NEGOTIATION: "Negotiation",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CONTACTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  QUOTATION_SENT: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  NEGOTIATION: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export default function AdminBulkOrdersPage() {
  const [requests, setRequests] = useState<BulkOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<BulkOrderRequest | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)

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

  const updateStatus = async (id: string, status: string) => {
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/bulk-orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev))
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
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
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
                    onClick={() => setSelected(r)}
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
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-y-auto animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.bulkOrderNumber}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Submitted {new Date(selected.createdAt).toLocaleString("en-IN")}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
            </div>

            {/* Status updater */}
            <div className="flex items-center gap-3 mb-6 p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
              <select
                value={selected.status}
                disabled={savingStatus}
                onChange={(e) => updateStatus(selected.id, e.target.value)}
                className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-primary-500 ${STATUS_COLORS[selected.status] || "bg-gray-100 text-gray-700"}`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              {savingStatus && <Loader2 size={16} className="animate-spin text-gray-400" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <DetailBlock icon={Building2} label="Company">
                {selected.companyName}
                {selected.gstNumber && <span className="block text-xs text-gray-400 mt-0.5">GST: {selected.gstNumber}</span>}
              </DetailBlock>
              <DetailBlock icon={Mail} label="Contact">
                {selected.contactPerson}
                <span className="block text-xs text-gray-400 mt-0.5">{selected.email}</span>
              </DetailBlock>
              <DetailBlock icon={Phone} label="Mobile">{selected.mobileNumber}</DetailBlock>
              <DetailBlock icon={MapPin} label="Business Address">{selected.businessAddress}</DetailBlock>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <DetailBlock icon={Package} label="Product(s)">
                {selected.products}
                {selected.product && (
                  <span className="block text-xs text-primary-600 mt-0.5">Linked: {selected.product.title}</span>
                )}
              </DetailBlock>
              <DetailBlock icon={Layers} label="Required Quantity">{selected.quantity}</DetailBlock>
              <DetailBlock icon={Wallet} label="Expected Budget">{selected.budget}</DetailBlock>
              <DetailBlock icon={CalendarDays} label="Expected Delivery">{new Date(selected.expectedDeliveryDate).toLocaleDateString("en-IN")}</DetailBlock>
            </div>

            <DetailBlock icon={MessageSquare} label="Message / Special Requirements" full>
              {selected.message}
            </DetailBlock>

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
          </div>
        </div>
      )}
    </div>
  )
}

function DetailBlock({ icon: Icon, label, children, full }: { icon: any; label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "mt-5" : ""}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        <Icon size={12} /> {label}
      </p>
      <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">{children}</div>
    </div>
  )
}
