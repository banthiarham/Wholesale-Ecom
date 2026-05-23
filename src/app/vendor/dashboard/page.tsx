"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Package, ShoppingBag, DollarSign, AlertTriangle, FileText } from "lucide-react"
import Header from "@/components/layout/Header"

interface DashboardData {
  productCount: number
  lowStockCount: number
  orderCount: number
  revenue: number
  pendingRfqCount: number
}

export default function VendorDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/vendor/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 403) { router.push("/"); return null }
        return res.json()
      })
      .then((d) => { if (d) setData(d); setLoading(false) })
  }, [router])

  const cards = [
    { label: "Products", value: data?.productCount ?? 0, icon: Package, href: "/vendor/products", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Orders", value: data?.orderCount ?? 0, icon: ShoppingBag, href: "/vendor/orders", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Revenue", value: `₹${(data?.revenue ?? 0).toLocaleString("en-IN")}`, icon: DollarSign, href: "/vendor/sales", color: "text-green-600", bg: "bg-green-50" },
    { label: "Low Stock", value: data?.lowStockCount ?? 0, icon: AlertTriangle, href: "/vendor/inventory", color: "text-red-600", bg: "bg-red-50" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Vendor Dashboard</h1>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

            {data && data.pendingRfqCount > 0 && (
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 mb-6">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-yellow-600" />
                  <div>
                    <p className="font-medium">{data.pendingRfqCount} open RFQ{data.pendingRfqCount > 1 ? "s" : ""} awaiting quotes</p>
                    <Link href="/vendor/rfqs" className="text-sm text-primary-600 hover:underline">View RFQs →</Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Link href="/vendor/products" className="bg-white rounded-lg border border-gray-100 p-5 hover:shadow-sm transition">
                <p className="font-medium text-gray-900 mb-1">Manage Products</p>
                <p className="text-sm text-gray-500">Update listings, pricing, and inventory</p>
              </Link>
              <Link href="/vendor/inventory" className="bg-white rounded-lg border border-gray-100 p-5 hover:shadow-sm transition">
                <p className="font-medium text-gray-900 mb-1">Inventory</p>
                <p className="text-sm text-gray-500">Track stock levels and adjust quantities</p>
              </Link>
              <Link href="/catalogs" className="bg-white rounded-lg border border-gray-100 p-5 hover:shadow-sm transition">
                <p className="font-medium text-gray-900 mb-1">Digital Catalogs</p>
                <p className="text-sm text-gray-500">Create and share product catalogs</p>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
