"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen } from "lucide-react"

interface Catalog {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  status: string
  vendor: { firstName: string; lastName: string; companyName: string | null } | null
  _count: { items: number }
}

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/catalogs?isPublic=true")
      .then((res) => res.json())
      .then((d) => { setCatalogs(d || []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Digital Catalogs</h1>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : catalogs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No public catalogs available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalogs.map((catalog) => (
              <Link key={catalog.id} href={`/catalogs/${catalog.id}`} className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <BookOpen size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{catalog.name}</p>
                    <p className="text-xs text-gray-500">{catalog.vendor?.companyName || `${catalog.vendor?.firstName || ""} ${catalog.vendor?.lastName || ""}`}</p>
                  </div>
                </div>
                {catalog.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{catalog.description}</p>}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{catalog._count.items} products</span>
                  <span className="text-primary-600">View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
