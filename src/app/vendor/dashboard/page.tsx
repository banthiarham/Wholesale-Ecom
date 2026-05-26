"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Package,
  ShoppingBag,
  IndianRupee,
  AlertTriangle,
  FileText,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  BarChart3,
  ChevronRight,
  Boxes,
  Truck,
  Star,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface DashboardData {
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

export default function VendorDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [pendingRfqs, setPendingRfqs] = useState<PendingRfq[]>([])
  const [sales, setSales] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState("")

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) { router.push("/login"); return }
    setToken(t)

    Promise.all([
      fetch("/api/vendor/dashboard", { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
      fetch("/api/vendor/orders", { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
      fetch("/api/vendor/rfqs", { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
      fetch("/api/vendor/sales?days=30", { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
    ])
      .then(([dash, orders, rfqs, salesData]) => {
        setData(dash)
        setRecentOrders((Array.isArray(orders) ? orders : []).slice(0, 5))
        setPendingRfqs((Array.isArray(rfqs) ? rfqs : []).slice(0, 3))
        setSales(salesData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-700",
      CONFIRMED: "bg-blue-100 text-blue-700",
      PROCESSING: "bg-purple-100 text-purple-700",
      SHIPPED: "bg-indigo-100 text-indigo-700",
      DELIVERED: "bg-green-100 text-green-700",
      CANCELLED: "bg-red-100 text-red-700",
    }
    return map[status] || "bg-gray-100 text-gray-700"
  }

  const maxRevenue = sales?.revenueByDay?.length
    ? Math.max(...sales.revenueByDay.map((d) => d.revenue))
    : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      label: "Products",
      value: data?.productCount ?? 0,
      icon: Package,
      href: "/vendor/products",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "Orders",
      value: data?.orderCount ?? 0,
      icon: ShoppingBag,
      href: "/vendor/orders",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
    },
    {
      label: "Revenue",
      value: formatPrice(data?.revenue ?? 0),
      icon: IndianRupee,
      href: "/vendor/orders",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100",
    },
    {
      label: "Low Stock",
      value: data?.lowStockCount ?? 0,
      icon: AlertTriangle,
      href: "/vendor/inventory",
      color: (data?.lowStockCount ?? 0) > 0 ? "text-red-600" : "text-gray-400",
      bg: (data?.lowStockCount ?? 0) > 0 ? "bg-red-50" : "bg-gray-50",
      border: (data?.lowStockCount ?? 0) > 0 ? "border-red-100" : "border-gray-100",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Overview of your store performance</p>
          </div>
          <Link
            href="/vendor/products?action=add"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> Add Product
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {statCards.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className={`${c.bg} ${c.border} border rounded-xl p-5 hover:shadow-md transition group`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">{c.label}</span>
                <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>
                  <c.icon size={18} className={c.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 group-hover:text-primary-600 transition">
                View details <ArrowRight size={12} className="group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left: Recent Orders */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Orders</h2>
              <Link href="/vendor/orders" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ShoppingBag size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">No orders yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentOrders.map((order) => (
                  <div key={order.id} className="px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">#{order.orderNumber?.slice(0, 8) || order.id.slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{order.user?.firstName} {order.user?.lastName} — {order.items?.length || 0} item(s)</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              {[
                { href: "/vendor/products?action=add", icon: Plus, label: "Add New Product", desc: "List a new product", color: "text-primary-600", bg: "bg-primary-50" },
                { href: "/vendor/inventory", icon: Boxes, label: "Update Inventory", desc: "Adjust stock levels", color: "text-amber-600", bg: "bg-amber-50" },
                { href: "/vendor/rfqs", icon: FileText, label: "Respond to RFQs", desc: `${data?.pendingRfqCount ?? 0} pending`, color: "text-blue-600", bg: "bg-blue-50" },
                { href: "/catalogs", icon: BarChart3, label: "Create Catalog", desc: "Share product catalog", color: "text-purple-600", bg: "bg-purple-50" },
                { href: "/vendor/orders", icon: Truck, label: "Manage Orders", desc: "Process & ship orders", color: "text-green-600", bg: "bg-green-50" },
              ].map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition group"
                >
                  <div className={`w-10 h-10 ${action.bg} rounded-lg flex items-center justify-center shrink-0`}>
                    <action.icon size={18} className={action.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-400">{action.desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Second row: Sales chart + Pending RFQs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sales chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Revenue (Last 30 Days)</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sales?.totalItems ?? 0} items sold — Total: {formatPrice(sales?.totalRevenue ?? 0)}
                </p>
              </div>
              <Link href="/analytics" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
                Details <ChevronRight size={14} />
              </Link>
            </div>
            <div className="px-6 py-6">
              {sales?.revenueByDay && sales.revenueByDay.length > 0 ? (
                <div className="flex items-end gap-1.5 h-36">
                  {sales.revenueByDay.map((d) => {
                    const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center group"
                        title={`${d.date}: ${formatPrice(d.revenue)}`}
                      >
                        <div className="relative w-full flex justify-center">
                          <div className="hidden group-hover:block absolute -top-6 text-[10px] font-medium text-gray-700 bg-gray-900 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                            {formatPrice(d.revenue)}
                          </div>
                        </div>
                        <div
                          className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition min-h-[4px]"
                          style={{ height: `${Math.max(height, 3)}%` }}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-36 flex items-center justify-center">
                  <p className="text-sm text-gray-400">No sales data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Pending RFQs */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Pending RFQs</h2>
              <Link href="/vendor/rfqs" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
                All <ChevronRight size={14} />
              </Link>
            </div>
            {pendingRfqs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">No pending RFQs</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingRfqs.map((rfq) => (
                  <Link
                    key={rfq.id}
                    href={`/rfqs/${rfq.id}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{rfq.title}</p>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-700 shrink-0 ml-2">
                        {rfq.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{rfq.buyer?.firstName} {rfq.buyer?.lastName}</span>
                      <span>{rfq._count?.quotes ?? 0} quote(s)</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Third row: Top Products + Low Stock Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Top Products</h2>
              <Link href="/vendor/products" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
                All <ChevronRight size={14} />
              </Link>
            </div>
            {sales?.topProducts && sales.topProducts.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {sales.topProducts.map((p, i) => (
                  <div key={i} className="px-6 py-3.5 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.product?.title}</p>
                      <p className="text-xs text-gray-400">{p.quantity} sold</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(p.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <Star size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">No sales data yet</p>
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
              <Link href="/vendor/inventory" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
                Manage <ChevronRight size={14} />
              </Link>
            </div>
            {(data?.lowStockCount ?? 0) > 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <p className="text-lg font-bold text-gray-900 mb-1">{data?.lowStockCount} products low on stock</p>
                <p className="text-sm text-gray-400 mb-4">Items with 10 or fewer units remaining</p>
                <Link
                  href="/vendor/inventory"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm font-semibold"
                >
                  <Boxes size={16} /> Restock Now
                </Link>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Boxes size={24} className="text-green-500" />
                </div>
                <p className="text-sm text-green-600 font-medium">All products well-stocked</p>
                <p className="text-xs text-gray-400 mt-1">No items below threshold</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}