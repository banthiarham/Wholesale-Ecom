"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart3, ArrowLeft, ShoppingBag, TrendingUp, Package, IndianRupee } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface TopProduct {
  id: string
  title: string
  thumbnail: string | null
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [topProduct, setTopProduct] = useState<TopProduct | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { setLoading(false); return }
    fetch("/api/analytics/buyer/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        setAnalytics(data)
        setLoading(false)
        // Enrich the raw top-product ID into a name + thumbnail using the
        // existing public products-by-ids endpoint — display-only, no new
        // backend surface, mirrors the same pattern used on the bulk-orders page.
        if (data?.topProductId) {
          fetch(`/api/products?ids=${data.topProductId}&limit=1`)
            .then((r) => (r.ok ? r.json() : null))
            .then((pData) => {
              const p = pData?.products?.[0]
              if (p?.id) setTopProduct({ id: p.id, title: p.title, thumbnail: p.thumbnail || p.images?.[0] || null })
            })
            .catch(() => {})
        }
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6 text-sm font-medium transition-colors"><ArrowLeft size={16} /> Back to home</Link>

        <span className="eyebrow">Account</span>
        <div className="flex items-center gap-2.5 mb-6">
          <BarChart3 className="text-primary-600" size={26} />
          <h1 className="heading-xl">My Analytics</h1>
        </div>

        {analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total spent — hero stat, matches the wallet balance card treatment */}
            <div
              className="relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-br from-primary-600 to-primary-700 md:col-span-1"
              style={{ boxShadow: "var(--shadow-card-lg)" }}
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <IndianRupee size={17} />
                </div>
                <p className="text-sm font-medium opacity-90">Total Spent</p>
              </div>
              <p className="relative text-3xl font-bold tracking-tight">{formatPrice(Number(analytics.totalSpent || 0))}</p>
            </div>

            <div className="card-base-static p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center"><ShoppingBag size={17} className="text-primary-600" /></div>
                <span className="text-sm text-gray-500">Total Orders</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{analytics.ordersCount || 0}</div>
            </div>

            <div className="card-base-static p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center"><TrendingUp size={17} className="text-purple-600" /></div>
                <span className="text-sm text-gray-500">Top Product</span>
              </div>
              {topProduct ? (
                <Link href={`/products/${topProduct.id}`} className="flex items-center gap-3 group">
                  <div className="w-11 h-11 rounded-lg bg-gray-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {topProduct.thumbnail ? (
                      <img src={topProduct.thumbnail} alt={topProduct.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={18} className="text-gray-300" />
                    )}
                  </div>
                  <span className="text-base font-bold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 leading-snug">{topProduct.title}</span>
                </Link>
              ) : analytics.topProductId ? (
                <div className="text-lg font-bold text-gray-900 truncate">{analytics.topProductId}</div>
              ) : (
                <div className="text-sm text-gray-400">No orders yet</div>
              )}
            </div>
          </div>
        ) : (
          <div className="card-base-static p-8 text-center">
            <Package size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Please sign in to view your analytics.</p>
            <Link href="/login" className="btn-primary">Sign In</Link>
          </div>
        )}
      </main>
    </div>
  )
}
