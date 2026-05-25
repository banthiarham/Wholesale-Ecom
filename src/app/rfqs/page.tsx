"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/layout/Header"
import { Plus, FileText, ArrowLeft } from "lucide-react"

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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700",
      SUBMITTED: "bg-blue-100 text-blue-700",
      UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
      QUOTED: "bg-purple-100 text-purple-700",
      ACCEPTED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
      EXPIRED: "bg-gray-100 text-gray-500",
    }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${map[status] || "bg-gray-100"}`}>{status}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Request for Quotes (RFQs)</h1>
          <Link href="/rfqs/new" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
            <Plus size={18} /> New RFQ
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : rfqs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No RFQs found.</p>
            <Link href="/rfqs/new" className="text-primary-600 hover:underline">Create your first RFQ</Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Quotes</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/rfqs/${rfq.id}`} className="font-medium text-gray-900 hover:text-primary-600">{rfq.title}</Link>
                      <p className="text-xs text-gray-500">{rfq.items.map((i) => i.product?.title).filter(Boolean).join(", ")}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(rfq.status)}</td>
                    <td className="px-4 py-3 text-gray-600">{rfq._count.quotes}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(rfq.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
