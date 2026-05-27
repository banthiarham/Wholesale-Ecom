"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  Tag,
  Warehouse,
  FileText,
  BookOpen,
  BarChart3,
  Ticket,
  Percent,
  Star,
  RotateCcw,
  Award,
  Bell,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Truck,
  PackageCheck,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Categories", href: "/admin/categories", icon: Tag },
  { label: "Inventory", href: "/admin/inventory", icon: Warehouse },
  { label: "RFQs", href: "/admin/rfqs", icon: FileText },
  { label: "Catalogs", href: "/admin/catalogs", icon: BookOpen },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "Discounts", href: "/admin/discounts", icon: Percent },
  { label: "Contract Prices", href: "/admin/contract-prices", icon: FileText },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Returns", href: "/admin/returns", icon: RotateCcw },
  { label: "Loyalty", href: "/admin/loyalty", icon: Award },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Site Settings", href: "/admin/settings", icon: Settings },
  { label: "Delivery Partners", href: "/admin/delivery-partners", icon: Truck },
  { label: "Shipment Tracking", href: "/admin/delivery-tracking", icon: PackageCheck },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [checking, setChecking] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized")
        return res.json()
      })
      .then((data) => {
        const user = data.user || data
        if (user?.role !== "ADMIN") {
          router.push("/")
          return
        }
        setUser(user)
        setChecking(false)
      })
      .catch(() => {
        localStorage.removeItem("token")
        router.push("/login")
      })
  }, [router])

  const logout = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {!collapsed && (
            <Link href="/admin" className="text-lg font-bold text-primary-700">
              Admin
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition ${
                  active
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className={`flex items-center gap-3 text-gray-600 hover:text-red-600 transition ${
              collapsed ? "justify-center" : ""
            }`}
            title="Logout"
          >
            <LogOut size={20} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-gray-900">
            {navItems.find((n) => n.href === pathname)?.label || "Admin"}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.firstName} {user?.lastName}</span>
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full font-medium uppercase">
              {user?.role}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
