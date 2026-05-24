"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Package, ShoppingBag, DollarSign, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  ordersByStatus: { status: string; count: number }[]
  recentActivity: { id: string; action: string; user: string; createdAt: string }[]
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, productsRes, ordersRes, analyticsRes, activityRes] = await Promise.all([
          fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/analytics/sales", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/analytics/activity?limit=10", { headers: { Authorization: `Bearer ${token}` } }),
        ])

        const users = usersRes.ok ? await usersRes.json() : { users: [] }
        const products = productsRes.ok ? await productsRes.json() : { products: [] }
        const orders = ordersRes.ok ? await ordersRes.json() : { orders: [] }
        const analytics = analyticsRes.ok ? await analyticsRes.json() : { totalRevenue: 0 }
        const activity = activityRes.ok ? await activityRes.json() : { activities: [] }

        setStats({
          totalUsers: users.users?.length ?? 0,
          totalProducts: products.products?.length ?? 0,
          totalOrders: orders.orders?.length ?? 0,
          totalRevenue: analytics.totalRevenue ?? 0,
          ordersByStatus: orders.ordersByStatus ?? [],
          recentActivity: activity.activities ?? [],
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, href: "/admin/users", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Products", value: stats?.totalProducts ?? 0, icon: Package, href: "/admin/products", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: ShoppingBag, href: "/admin/orders", color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: DollarSign, href: "/admin/orders", color: "text-amber-600", bg: "bg-amber-50" },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`${c.bg} rounded-lg border border-gray-100 p-5 hover:shadow-sm transition`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{c.label}</span>
              <c.icon size={20} className={c.color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                  <Activity size={16} className="text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{a.action}</p>
                    <p className="text-xs text-gray-500">{a.user} · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent activity.</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/users" className="p-4 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition">
              <Users size={20} className="text-primary-600 mb-2" />
              <p className="font-medium text-sm text-gray-900">Manage Users</p>
            </Link>
            <Link href="/admin/products" className="p-4 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition">
              <Package size={20} className="text-primary-600 mb-2" />
              <p className="font-medium text-sm text-gray-900">Manage Products</p>
            </Link>
            <Link href="/admin/orders" className="p-4 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition">
              <ShoppingBag size={20} className="text-primary-600 mb-2" />
              <p className="font-medium text-sm text-gray-900">Manage Orders</p>
            </Link>
            <Link href="/admin/categories" className="p-4 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition">
              <TrendingUp size={20} className="text-primary-600 mb-2" />
              <p className="font-medium text-sm text-gray-900">Manage Categories</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
