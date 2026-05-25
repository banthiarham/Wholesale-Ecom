"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, FileText } from "lucide-react"

interface Rfq {
  id: string
  title: string
  status: string
  buyer: { firstName: string; lastName: string; email: string; companyName: string | null }
  items: { id: string; product?: { id: string; title: string }; description: string | null; quantity: number; unit: string }[]
}

export default function VendorRfqsPage() {
  const router = useRouter()
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)
  const [quoting, setQuoting] = useState(false)
  const [selected, setSelected] = useState<Rfq | null>(null)
  const [quoteItems, setQuoteItems] = useState<{ rfqItemId: string; unitPrice: string; quantity: string; leadTimeDays: string; notes: string }[]>([])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/vendor/rfqs", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((d) => { setRfqs(Array.isArray(d) ? d : []); setLoading(false) })
  }, [router])

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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-4"><ArrowLeft size={16} /> Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Open RFQs</h1>

        {rfqs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No open RFQs at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rfqs.map((rfq) => (
              <div key={rfq.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{rfq.title}</p>
                    <p className="text-xs text-gray-500">{rfq.buyer.firstName} {rfq.buyer.lastName} • {rfq.buyer.email}</p>
                  </div>
                  <button onClick={() => openQuote(rfq)} className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 transition">
                    <Send size={14} className="inline mr-1" /> Quote
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  {rfq.items.map((it, i) => (
                    <span key={i} className="mr-3">{it.product?.title || it.description || "Item"} x {it.quantity} {it.unit}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <h3 className="font-semibold mb-4">Submit Quote: {selected.title}</h3>
              <div className="space-y-3">
                {selected.items.map((item, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium mb-2">{item.product?.title || item.description || "Item"} — Qty: {item.quantity} {item.unit}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="Unit Price ₹"
                        value={quoteItems[i]?.unitPrice || ""}
                        onChange={(e) => {
                          const updated = [...quoteItems]
                          updated[i] = { ...updated[i], unitPrice: e.target.value }
                          setQuoteItems(updated)
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
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
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
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
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setSelected(null)} className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={submitQuote} disabled={quoting} className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                  {quoting ? "Submitting..." : "Submit Quote"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
