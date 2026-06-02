"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Send, FileText } from "lucide-react"
import { useAuth } from "@/lib/auth"

interface Quote {
  id: string
  status: string
  totalAmount: number
  notes: string
  vendor: { firstName: string; lastName: string; companyName: string | null; email: string }
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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-blue-100 text-blue-700", UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
      QUOTED: "bg-purple-100 text-purple-700", ACCEPTED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700",
      PENDING: "bg-gray-100 text-gray-700",
    }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${map[status] || "bg-gray-100"}`}>{status}</span>
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
  if (!rfq) return <div className="min-h-screen flex flex-col items-center justify-center"><FileText size={48} className="text-gray-300 mb-4" /><p>RFQ not found</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/rfqs" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to RFQs</Link>

        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{rfq.title}</h1>
          {statusBadge(rfq.status)}
        </div>
        {rfq.description && <p className="text-gray-600 mb-4">{rfq.description}</p>}
        {rfq.notes && <p className="text-sm text-gray-500 mb-4">Notes: {rfq.notes}</p>}

        {rfq.status === "DRAFT" && (
          <button onClick={submit} disabled={actionLoading} className="mb-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
            <Send size={16} className="inline mr-1" /> {actionLoading ? "Submitting..." : "Submit RFQ"}
          </button>
        )}

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4">Items</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-left">Qty</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Target Price</th></tr></thead>
            <tbody>
              {rfq.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-3 py-2">{item.product?.title || item.description || "N/A"}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.unit}</td>
                  <td className="px-3 py-2">{item.targetPrice ? `₹${item.targetPrice}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold mb-4">Quotes ({rfq.quotes.length})</h2>
          {rfq.quotes.length === 0 ? (
            <p className="text-gray-500">No quotes yet. Vendors can submit quotes once the RFQ is submitted.</p>
          ) : (
            <div className="space-y-4">
              {rfq.quotes.map((quote) => (
                <div key={quote.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{quote.vendor.companyName || `${quote.vendor.firstName} ${quote.vendor.lastName}`}</p>
                      <p className="text-xs text-gray-500">{quote.vendor.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(quote.status)}
                      <span className="font-bold text-primary-700">₹{Number(quote.totalAmount).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  {quote.notes && <p className="text-sm text-gray-600 mb-2">{quote.notes}</p>}
                  <div className="text-sm text-gray-600 mb-2">
                    {quote.items.map((it, i) => (
                      <span key={i} className="mr-3">₹{Number(it.unitPrice)} x {it.quantity} = ₹{Number(it.totalPrice)}{it.leadTimeDays ? ` (${it.leadTimeDays}d)` : ""}</span>
                    ))}
                  </div>
                  {quote.status === "PENDING" && effectiveRole === "BUYER" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => acceptQuote(quote.id)} disabled={actionLoading} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition disabled:opacity-50">
                        <CheckCircle size={14} className="inline mr-1" /> Accept
                      </button>
                      <button onClick={() => rejectQuote(quote.id)} disabled={actionLoading} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition disabled:opacity-50">
                        <XCircle size={14} className="inline mr-1" /> Reject
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
