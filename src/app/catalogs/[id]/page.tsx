"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen, Download, FileText } from "lucide-react"

interface CatalogDetail {
  id: string
  name: string
  description: string | null
  vendor: { firstName: string; lastName: string; companyName: string | null }
  items: {
    id: string
    product: { id: string; title: string; sku: string | null; unitPrice: number; thumbnail: string | null; moq: number; tierPrices: { minQty: number; maxQty: number | null; price: number }[] }
    customPrice: number | null
  }[]
  pdfUrl: string | null
}

export default function CatalogDetailPage() {
  const params = useParams()
  const [catalog, setCatalog] = useState<CatalogDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/catalogs/${params.id}`)
      .then((res) => res.json())
      .then((d) => { setCatalog(d); setLoading(false) })
  }, [params.id])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
  if (!catalog) return <div className="min-h-screen flex flex-col items-center justify-center"><FileText size={48} className="text-gray-300 mb-4" /><p>Catalog not found</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/catalogs" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to Catalogs</Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{catalog.name}</h1>
            <p className="text-sm text-gray-500">{catalog.vendor?.companyName || `${catalog.vendor?.firstName || ""} ${catalog.vendor?.lastName || ""}`}</p>
          </div>
          {catalog.pdfUrl && (
            <a href={`/api/catalogs/${catalog.id}/download`} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition">
              <Download size={16} /> Download PDF
            </a>
          )}
        </div>

        {catalog.description && <p className="text-gray-600 mb-6">{catalog.description}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.items.map((item) => {
            const p = item.product
            const price = item.customPrice || p.unitPrice
            return (
              <Link key={item.id} href={`/products/${p.sku ? p.sku.toLowerCase().replace(/\s+/g, '-') : p.id}`} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
                <div className="w-full h-40 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.title} className="w-full h-40 object-cover rounded-lg" />
                  ) : (
                    <BookOpen size={32} className="text-gray-300" />
                  )}
                </div>
                <p className="font-medium text-gray-900 mb-1">{p.title}</p>
                <p className="text-sm text-gray-500 mb-2">SKU: {p.sku || "-"} | MOQ: {p.moq}</p>
                <p className="text-lg font-bold text-primary-700">₹{Number(price).toLocaleString("en-IN")}</p>
                {p.tierPrices.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Tier pricing available
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
