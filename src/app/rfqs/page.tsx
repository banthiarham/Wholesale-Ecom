"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, FileText } from "lucide-react"
import { RfqStatusBadge } from "@/components/rfqs/StatusBadge"

interface Rfq {
  id: string
  title: string
  status: string
  createdAt: string
  _count: { quotes: number }
  items: { product?: { title: string } }[]
}

export default function RfqsPage() {
  const router = useRouter()
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/rfqs", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setRfqs(Array.isArray(data) ? data : []); setLoading(false) })
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="eyebrow">B2B Marketplace</span>
            <h1 className="heading-xl">Request for Quotes</h1>
            <p className="body-sm mt-1">{rfqs.length} RFQ{rfqs.length !== 1 ? "s" : ""} submitted</p>
          </div>
          <Link href="/rfqs/new" className="btn-primary">
            <Plus size={18} /> New RFQ
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : rfqs.length === 0 ? (
          <div className="card-base-static p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No RFQs found.</p>
            <Link href="/rfqs/new" className="text-primary-600 font-semibold hover:underline">Create your first RFQ</Link>
          </div>
        ) : (
          <div className="card-base-static overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quotes</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/rfqs/${rfq.id}`} className="font-semibold text-gray-900 hover:text-primary-600 transition-colors">{rfq.title}</Link>
                      <p className="text-xs text-gray-400 mt-0.5">{rfq.items.map((i) => i.product?.title).filter(Boolean).join(", ")}</p>
                    </td>
                    <td className="px-4 py-4"><RfqStatusBadge status={rfq.status} /></td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-primary-50 text-primary-700 text-xs font-bold">
                        {rfq._count.quotes}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(rfq.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
