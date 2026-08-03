"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Send, FileText, Package, Store } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { RfqStatusBadge, QuoteStatusBadge } from "@/components/rfqs/StatusBadge"

interface Quote {
  id: string
  status: string
  totalAmount: number
  notes: string
  vendor: { id: string; firstName: string; lastName: string; companyName: string | null; email: string }
  items: { unitPrice: number; quantity: number; totalPrice: number; leadTimeDays: number | null }[]
}

interface RfqDetail {
  id: string
  title: string
  description: string | null
  status: string
  notes: string | null
  items: { id: string; product?: { title: string; sku: string | null }; description: string | null; quantity: number; unit: string; targetPrice: number | null }[]
  quotes: Quote[]
}

export default function RfqDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, role } = useAuth()
  const [rfq, setRfq] = useState<RfqDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const effectiveRole = user?.effectiveRole || role?.name || user?.role || ""

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch(`/api/rfqs/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setRfq(data); setLoading(false) })
  }, [params.id, router])

  const submit = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    setActionLoading(true)
    const res = await fetch(`/api/rfqs/${params.id}/submit`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) window.location.reload()
    else setActionLoading(false)
  }

  const acceptQuote = async (quoteId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    setActionLoading(true)
    const res = await fetch(`/api/quotes/${quoteId}/accept`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) window.location.reload()
    else setActionLoading(false)
  }

  const rejectQuote = async (quoteId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    setActionLoading(true)
    const res = await fetch(`/api/quotes/${quoteId}/reject`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) window.location.reload()
    else setActionLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
  if (!rfq) return <div className="min-h-screen flex flex-col items-center justify-center"><FileText size={48} className="text-gray-300 mb-4" /><p className="text-gray-500">RFQ not found</p></div>

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container max-w-5xl py-8">
        <Link href="/rfqs" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6 text-sm font-medium transition-colors"><ArrowLeft size={16} /> Back to RFQs</Link>

        <div className="card-base-static p-6 mb-6">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="heading-lg">{rfq.title}</h1>
            <RfqStatusBadge status={rfq.status} />
          </div>
          {rfq.description && <p className="text-gray-600 mt-2">{rfq.description}</p>}
          {rfq.notes && <p className="text-sm text-gray-500 mt-1">Notes: {rfq.notes}</p>}

          {rfq.status === "DRAFT" && (
            <button onClick={submit} disabled={actionLoading} className="btn-primary mt-4">
              <Send size={16} /> {actionLoading ? "Submitting..." : "Submit RFQ"}
            </button>
          )}
        </div>

        <div className="card-base-static p-6 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Package className="text-primary-600" size={19} />
            <h2 className="font-bold text-gray-900">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Qty</th><th className="px-3 py-2.5">Unit</th><th className="px-3 py-2.5">Target Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rfq.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-gray-900 font-medium">{item.product?.title || item.description || "N/A"}</td>
                    <td className="px-3 py-3 text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-3 text-gray-600">{item.unit}</td>
                    <td className="px-3 py-3 text-gray-600">{item.targetPrice ? `₹${item.targetPrice}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-base-static p-6">
          <h2 className="font-bold text-gray-900 mb-4">Quotes ({rfq.quotes.length})</h2>
          {rfq.quotes.length === 0 ? (
            <p className="text-gray-500">No quotes yet. Vendors can submit quotes once the RFQ is submitted.</p>
          ) : (
            <div className="space-y-4">
              {rfq.quotes.map((quote) => (
                <div key={quote.id} className="card-interactive p-4">
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <Link href={`/vendors/${quote.vendor.id}`} className="inline-flex items-center gap-1.5 font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                        <Store size={14} className="text-gray-400" />
                        {quote.vendor.companyName || `${quote.vendor.firstName} ${quote.vendor.lastName}`}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{quote.vendor.email}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <QuoteStatusBadge status={quote.status} />
                      <span className="font-bold text-primary-700">₹{Number(quote.totalAmount).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  {quote.notes && <p className="text-sm text-gray-600 mb-2.5">{quote.notes}</p>}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
                    {quote.items.map((it, i) => (
                      <span key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">₹{Number(it.unitPrice)} × {it.quantity} = ₹{Number(it.totalPrice)}{it.leadTimeDays ? ` (${it.leadTimeDays}d)` : ""}</span>
                    ))}
                  </div>
                  {quote.status === "PENDING" && effectiveRole === "BUYER" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => acceptQuote(quote.id)} disabled={actionLoading} className="btn-sm bg-green-600 hover:bg-green-700 focus:ring-green-500">
                        <CheckCircle size={14} /> Accept
                      </button>
                      <button onClick={() => rejectQuote(quote.id)} disabled={actionLoading} className="btn-sm bg-red-600 hover:bg-red-700 focus:ring-red-500">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
