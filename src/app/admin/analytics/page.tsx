"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart3, TrendingUp, Package, ShoppingBag, IndianRupee, Activity, ChevronRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"

export default function AdminAnalyticsPage() {
  const [sales, setSales] = useState<any>(null)
  const [ordersByStatus, setOrdersByStatus] = useState<any>(null)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const statusColor: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-purple-100 text-purple-700",
    SHIPPED: "bg-indigo-100 text-indigo-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-orange-100 text-orange-700",
  }

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return
    const params = new URLSearchParams()
    if (dateFrom) params.set("startDate", dateFrom)
    if (dateTo) params.set("endDate", dateTo)
    const qs = params.toString() ? `?${params.toString()}` : ""

    Promise.all([
      fetch(`/api/analytics/sales${qs}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`/api/analytics/orders-by-status${qs}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`/api/analytics/top-products?limit=10`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/analytics/activity?limit=20", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([s, obs, tp, act]) => {
        setSales(s)
        setOrdersByStatus(obs)
        setTopProducts(Array.isArray(tp) ? tp : tp.products ?? [])
        setActivity(act.activities ?? act.recentOrders ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
  }

  const totalOrders = sales?.totalOrders ?? 0
  const totalRevenue = sales?.totalRevenue ?? 0
  const totalProductsSold = sales?.totalProductsSold ?? sales?.totalItems ?? 0
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <span className="text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><IndianRupee size={20} className="text-green-600" /><span className="text-sm text-gray-600">Total Revenue</span></div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><ShoppingBag size={20} className="text-blue-600" /><span className="text-sm text-gray-600">Total Orders</span></div>
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><Package size={20} className="text-purple-600" /><span className="text-sm text-gray-600">Products Sold</span></div>
          <p className="text-2xl font-bold text-gray-900">{totalProductsSold}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2"><TrendingUp size={20} className="text-amber-600" /><span className="text-sm text-gray-600">Avg Order Value</span></div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(avgOrderValue)}</p>
        </div>
      </div>

      {/* Orders by Status */}
      {ordersByStatus && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Orders by Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {Object.entries(ordersByStatus).map(([status, count]) => (
              <div key={status} className="text-center p-3 bg-gray-50 rounded-lg">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-2 ${statusColor[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>
                <p className="text-lg font-bold text-gray-900">{count as number}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Top Products</h2>
          <Link href="/admin/products" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">View All <ChevronRight size={14} /></Link>
        </div>
        {topProducts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-600">#</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-6 py-3 text-right font-medium text-gray-600">Quantity Sold</th>
                <th className="px-6 py-3 text-right font-medium text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topProducts.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3"><span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 text-xs font-bold flex items-center justify-center">{i + 1}</span></td>
                  <td className="px-6 py-3 font-medium text-gray-900">{item.product?.title || item.productId}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{item._sum?.quantity ?? item.quantity ?? 0}</td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatPrice(item._sum?.totalPrice ?? item.revenue ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center"><BarChart3 size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-sm text-gray-400">No product data available</p></div>
        )}
      </div>

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {activity.map((a: any, i: number) => (
              <div key={a.id || i} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                <Activity size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{a.action || a.title || "Activity"}</p>
                  <p className="text-xs text-gray-500">{a.user || a.buyer || ""} {a.createdAt ? `· ${new Date(a.createdAt).toLocaleString()}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}