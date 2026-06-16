"use client"

import { useEffect, useState } from "react"
import { FileText, Send, Search } from "lucide-react"
import { SkeletonList } from "@/components/admin/Skeleton"

interface Rfq {
  id: string
  title: string
  status: string
  createdAt: string
  buyer: { firstName: string; lastName: string; email: string; companyName: string | null }
  items: { id: string; product?: { id: string; title: string }; description: string | null; quantity: number; unit: string }[]
  _count?: { quotes: number }
}

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    UNDER_REVIEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    QUOTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  return map[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
}

export default function AdminRfqsPage() {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [filtered, setFiltered] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)
  const [quoting, setQuoting] = useState(false)
  const [selected, setSelected] = useState<Rfq | null>(null)
  const [quoteItems, setQuoteItems] = useState<{ rfqItemId: string; unitPrice: string; quantity: string; leadTimeDays: string; notes: string }[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return
    fetch("/api/rfqs", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((d) => {
        const data = Array.isArray(d) ? d : d.rfqs ?? []
        setRfqs(data)
        setFiltered(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    let result = rfqs
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.buyer?.firstName?.toLowerCase().includes(q) ||
        r.buyer?.lastName?.toLowerCase().includes(q) ||
        r.buyer?.email?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter)
    }
    setFiltered(result)
  }, [search, statusFilter, rfqs])

  const openQuote = (rfq: Rfq) => {
    setSelected(rfq)
    setQuoteItems(rfq.items.map((it) => ({
      rfqItemId: it.id,
      unitPrice: "",
      quantity: String(it.quantity),
      leadTimeDays: "",
      notes: "",
    })))
  }

  const submitQuote = async () => {
    if (!selected) return
    const token = localStorage.getItem("token")
    setQuoting(true)
    const body = {
      items: quoteItems.filter((it) => it.unitPrice).map((it) => ({
        rfqItemId: it.rfqItemId,
        unitPrice: Number(it.unitPrice),
        quantity: Number(it.quantity),
        leadTimeDays: it.leadTimeDays ? Number(it.leadTimeDays) : undefined,
        notes: it.notes,
      })),
    }
    const res = await fetch(`/api/rfqs/${selected.id}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setSelected(null)
      window.location.reload()
    } else {
      setQuoting(false)
      alert("Failed to submit quote")
    }
  }

  if (loading) {
    return <SkeletonList rows={5} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">RFQs</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search RFQs by title or buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="QUOTED">Quoted</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* RFQ List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <FileText size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No RFQs found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((rfq) => (
            <div key={rfq.id} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{rfq.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(rfq.status)}`}>
                      {rfq.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {rfq.buyer?.firstName} {rfq.buyer?.lastName} &bull; {rfq.buyer?.email}
                    {rfq._count?.quotes !== undefined && ` &bull; ${rfq._count.quotes} quote(s)`}
                  </p>
                </div>
                <button
                  onClick={() => openQuote(rfq)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
                >
                  <Send size={14} /> Quote
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400">
                {rfq.items.map((it, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded text-xs">
                    {it.product?.title || it.description || "Item"} x {it.quantity} {it.unit}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Submit Quote: {selected.title}</h3>
            <div className="space-y-3">
              {selected.items.map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {item.product?.title || item.description || "Item"} — Qty: {item.quantity} {item.unit}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Unit Price"
                      value={quoteItems[i]?.unitPrice || ""}
                      onChange={(e) => {
                        const updated = [...quoteItems]
                        updated[i] = { ...updated[i], unitPrice: e.target.value }
                        setQuoteItems(updated)
                      }}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="number"
                      placeholder="Lead Time (days)"
                      value={quoteItems[i]?.leadTimeDays || ""}
                      onChange={(e) => {
                        const updated = [...quoteItems]
                        updated[i] = { ...updated[i], leadTimeDays: e.target.value }
                        setQuoteItems(updated)
                      }}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      placeholder="Notes"
                      value={quoteItems[i]?.notes || ""}
                      onChange={(e) => {
                        const updated = [...quoteItems]
                        updated[i] = { ...updated[i], notes: e.target.value }
                        setQuoteItems(updated)
                      }}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-sm font-medium dark:text-gray-200">
                Cancel
              </button>
              <button onClick={submitQuote} disabled={quoting} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
                {quoting ? "Submitting..." : "Submit Quote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}