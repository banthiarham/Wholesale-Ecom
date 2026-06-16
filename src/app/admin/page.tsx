"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  Package,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  FileText,
  Plus,
  Activity,
  ChevronRight,
  Clock,
  Boxes,
  Star,
  IndianRupee,
  Truck,
  BarChart3,
  Landmark,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { DashboardSkeleton } from "@/components/admin/Skeleton"

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  recentActivity: { id: string; action: string; user: string; createdAt: string }[]
}

interface VendorDashData {
  productCount: number
  lowStockCount: number
  orderCount: number
  revenue: number
  pendingRfqCount: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  user: { firstName: string; lastName: string }
  items: { product: { title: string }; quantity: number; totalPrice: number }[]
}

interface PendingRfq {
  id: string
  title: string
  status: string
  createdAt: string
  buyer: { firstName: string; lastName: string }
  _count: { quotes: number }
}

interface SalesData {
  totalRevenue: number
  totalItems: number
  revenueByDay: { date: string; revenue: number }[]
  topProducts: { product: { title: string }; quantity: number; revenue: number }[]
}

interface OrdersByStatus {
  [key: string]: number
}

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    PROCESSING: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    SHIPPED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    DELIVERED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  return map[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
}

/** Mini sparkline SVG from revenue data */
function Sparkline({ data, color = "#3b82f6" }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const w = 80
  const h = 28
  const step = w / (data.length - 1 || 1)
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [vendorData, setVendorData] = useState<VendorDashData | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [pendingRfqs, setPendingRfqs] = useState<PendingRfq[]>([])
  const [sales, setSales] = useState<SalesData | null>(null)
  const [ordersByStatus, setOrdersByStatus] = useState<OrdersByStatus | null>(null)
  const [paymentOffersCount, setPaymentOffersCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    Promise.all([
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/analytics/sales", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/analytics/orders-by-status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/analytics/activity?limit=10", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/rfqs", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/pricing/payment-offers").then((r) => r.json()),
    ])
      .then(([users, products, orders, analytics, ordersStatus, activity, rfqsData, inventoryData, paymentOffersData]) => {
        const inventoryItems = Array.isArray(inventoryData) ? inventoryData : inventoryData.items ?? inventoryData.inventory ?? []
        const lowStockCount = inventoryItems.filter((item: any) => (item.stock ?? item.quantity ?? 0) <= 10).length

        setStats({
          totalUsers: users.users?.length ?? 0,
          totalProducts: products.products?.length ?? 0,
          totalOrders: orders.orders?.length ?? 0,
          totalRevenue: analytics.totalRevenue ?? 0,
          recentActivity: activity.activities ?? [],
        })
        setOrdersByStatus(ordersStatus)
        setVendorData({
          productCount: products.products?.length ?? 0,
          lowStockCount,
          orderCount: orders.orders?.length ?? 0,
          revenue: analytics.totalRevenue ?? 0,
          pendingRfqCount: Array.isArray(rfqsData) ? rfqsData.filter((r: any) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length : 0,
        })
        setRecentOrders((orders.orders ?? []).slice(0, 5))
        const allRfqs = Array.isArray(rfqsData) ? rfqsData : rfqsData.rfqs ?? []
        setPendingRfqs(allRfqs.filter((r: any) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').slice(0, 5))
        setSales(analytics)
        const offersList = Array.isArray(paymentOffersData) ? paymentOffersData : paymentOffersData.offers || []
        setPaymentOffersCount(offersList.filter((o: any) => o.isActive).length)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const maxRevenue = sales?.revenueByDay?.length
    ? Math.max(...sales.revenueByDay.map((d) => d.revenue))
    : 0

  // Sparkline data: last 7 days of revenue
  const sparklineData = sales?.revenueByDay?.slice(-7).map(d => d.revenue) ?? []

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, href: "/admin/users", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", sparkColor: "#3b82f6" },
    { label: "Total Products", value: stats?.totalProducts ?? 0, icon: Package, href: "/admin/products", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", sparkColor: "#9333ea" },
    { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: ShoppingBag, href: "/admin/orders", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", sparkColor: "#22c55e" },
    { label: "Total Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: IndianRupee, href: "/admin/orders", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", sparkColor: "#f59e0b", isPrice: true },
    { label: "Low Stock", value: vendorData?.lowStockCount ?? 0, icon: AlertTriangle, href: "/admin/inventory", color: (vendorData?.lowStockCount ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400", bg: (vendorData?.lowStockCount ?? 0) > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-800", sparkColor: "#ef4444" },
    { label: "Pending RFQs", value: vendorData?.pendingRfqCount ?? 0, icon: FileText, href: "/admin/rfqs", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20", sparkColor: "#eab308" },
    { label: "Payment Offers", value: paymentOffersCount, icon: Landmark, href: "/admin/payment-offers", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20", sparkColor: "#6366f1" },
  ]

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`${c.bg} rounded-xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-sm transition group`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{c.label}</span>
              <c.icon size={18} className={c.color} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{c.value}</p>
            {/* Sparkline */}
            {sparklineData.length > 1 && !c.isPrice && (
              <div className="mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={sparklineData} color={c.sparkColor} />
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { href: "/admin/products", icon: Plus, label: "Add Product", color: "text-primary-600 dark:text-primary-400", bg: "bg-primary-50 dark:bg-primary-900/20" },
            { href: "/admin/inventory", icon: Boxes, label: "Update Inventory", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
            { href: "/admin/rfqs", icon: FileText, label: "Respond to RFQs", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
            { href: "/admin/orders", icon: Truck, label: "Manage Orders", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
            { href: "/admin/users", icon: Users, label: "Manage Users", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
            { href: "/admin/payment-offers", icon: Landmark, label: "Payment Offers", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          ].map((action) => (
            <Link key={action.label} href={action.href} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition group">
              <div className={`w-10 h-10 ${action.bg} rounded-lg flex items-center justify-center shrink-0`}>
                <action.icon size={18} className={action.color} />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content grid: Recent Orders + Pending RFQs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1">
              View All <ChevronRight size={14} />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShoppingBag size={28} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No orders yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Orders will appear here when placed</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {recentOrders.map((order) => (
                <div key={order.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">#{order.orderNumber?.slice(0, 8) || order.id.slice(0, 8)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatPrice(order.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>{order.user?.firstName} {order.user?.lastName} — {order.items?.length || 0} item(s)</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending RFQs */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Pending RFQs</h2>
            <Link href="/admin/rfqs" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1">
              All <ChevronRight size={14} />
            </Link>
          </div>
          {pendingRfqs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText size={28} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No pending RFQs</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">New requests will show up here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {pendingRfqs.map((rfq) => (
                <Link key={rfq.id} href="/admin/rfqs" className="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{rfq.title}</p>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 shrink-0 ml-2">
                      {rfq.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>{rfq.buyer?.firstName} {rfq.buyer?.lastName}</span>
                    <span>{rfq._count?.quotes ?? 0} quote(s)</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Revenue (Last 30 Days)</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {sales?.totalItems ?? 0} items sold — Total: {formatPrice(sales?.totalRevenue ?? 0)}
              </p>
            </div>
          </div>
          <div className="px-6 py-6">
            {sales?.revenueByDay && sales.revenueByDay.length > 0 ? (
              <div className="flex items-end gap-1.5 h-36">
                {sales.revenueByDay.map((d) => {
                  const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center group" title={`${d.date}: ${formatPrice(d.revenue)}`}>
                      <div className="relative w-full flex justify-center">
                        <div className="hidden group-hover:block absolute -top-6 text-[10px] font-medium text-white bg-gray-900 dark:bg-gray-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {formatPrice(d.revenue)}
                        </div>
                      </div>
                      <div className="w-full bg-primary-500 dark:bg-primary-600 rounded-t hover:bg-primary-600 dark:hover:bg-primary-500 transition min-h-[4px]" style={{ height: `${Math.max(height, 3)}%` }} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BarChart3 size={28} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No sales data yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Revenue chart will appear with sales</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Top Products</h2>
            <Link href="/admin/products" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1">
              All <ChevronRight size={14} />
            </Link>
          </div>
          {sales?.topProducts && sales.topProducts.length > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {sales.topProducts.slice(0, 5).map((p, i) => (
                <div key={i} className="px-6 py-3.5 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.product?.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.quantity} sold</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Star size={28} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No sales data yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Top products will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        {ordersByStatus && Object.keys(ordersByStatus).length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Orders by Status</h2>
              <Link href="/admin/orders" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="space-y-3">
              {Object.entries(ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(status)}`}>
                      {status}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h2>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <Activity size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{a.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{a.user} · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Activity size={28} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No recent activity</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Actions will appear here</p>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Low Stock Alerts</h2>
            <Link href="/admin/inventory" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1">
              Manage <ChevronRight size={14} />
            </Link>
          </div>
          {(vendorData?.lowStockCount ?? 0) > 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red-500 dark:text-red-400" />
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{vendorData?.lowStockCount} products low on stock</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Items with 10 or fewer units remaining</p>
              <Link
                href="/admin/inventory"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
              >
                <Boxes size={16} /> Restock Now
              </Link>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Boxes size={24} className="text-green-500 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">All products well-stocked</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No items below threshold</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}