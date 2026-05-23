"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart3, ArrowLeft, ShoppingBag, DollarSign, Package, TrendingUp } from "lucide-react"

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { setLoading(false); return }
    fetch("/api/analytics/buyer/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setAnalytics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4">
            <Link href="/" className="text-gray-600 hover:text-primary-600">Home</Link>
            <Link href="/products" className="text-gray-600 hover:text-primary-600">Products</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to home</Link>

        <div className="flex items-center gap-3 mb-6">
          <BarChart3 size={28} className="text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">My Analytics</h1>
        </div>

        {analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingBag size={20} className="text-primary-600" />
                  <span className="text-sm text-gray-500">Total Orders</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{analytics.ordersCount || 0}</div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign size={20} className="text-green-600" />
                  <span className="text-sm text-gray-500">Total Spent</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">₹{Number(analytics.totalSpent || 0).toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={20} className="text-purple-600" />
                  <span className="text-sm text-gray-500">Top Product ID</span>
                </div>
                <div className="text-xl font-bold text-gray-900 truncate">{analytics.topProductId || "N/A"}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <Package size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Please sign in to view your analytics.</p>
            <Link href="/login" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Sign In</Link>
          </div>
        )}
      </main>
    </div>
  )
}
