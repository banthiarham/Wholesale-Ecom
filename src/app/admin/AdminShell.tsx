"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
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
  Server,
  Landmark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Settings,
  Truck,
  PackageCheck,
  Shield,
  DollarSign,
  ClipboardList,
  Sparkles,
  Wallet,
  Image,
  LayoutDashboard as LayoutIcon,
  Scale,
  Workflow,
  Menu,
  X,
  Search,
  ChevronRight as ChevronRightIcon,
  Moon,
  Sun,
  Layers,
} from "lucide-react"
import { useAuth, usePermissions } from "@/lib/auth"

// ── Navigation groups ──

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    title: "Commerce",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Packages", href: "/admin/packages", icon: Layers },
      { label: "Categories", href: "/admin/categories", icon: Tag },
      { label: "Inventory", href: "/admin/inventory", icon: Warehouse },
      { label: "Bulk Orders", href: "/admin/bulk-orders", icon: ClipboardList },
      { label: "Addons", href: "/admin/addons", icon: Sparkles },
    ],
  },
  {
    title: "Orders & Fulfillment",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
      { label: "RFQs", href: "/admin/rfqs", icon: FileText },
      { label: "Returns", href: "/admin/returns", icon: RotateCcw },
      { label: "Delivery Partners", href: "/admin/delivery-partners", icon: Truck },
      { label: "Shipment Tracking", href: "/admin/delivery-tracking", icon: PackageCheck },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Coupons", href: "/admin/coupons", icon: Ticket },
      { label: "Discounts", href: "/admin/discounts", icon: Percent },
      { label: "Payment Offers", href: "/admin/payment-offers", icon: Landmark },
      { label: "Banners", href: "/admin/banners", icon: Image },
      { label: "Homepage", href: "/admin/home-sections", icon: LayoutIcon },
    ],
  },
  {
    title: "Pricing",
    items: [
      { label: "Role Pricing", href: "/admin/role-prices", icon: DollarSign },
      { label: "Contract Prices", href: "/admin/contract-prices", icon: Scale },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Roles", href: "/admin/roles", icon: Shield },
      { label: "Role Requests", href: "/admin/role-requests", icon: ClipboardList },
      { label: "Dynamic Rules", href: "/admin/rules", icon: Workflow },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
      { label: "Loyalty", href: "/admin/loyalty", icon: Award },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
      { label: "Payment Gateways", href: "/admin/payment-gateways", icon: Server },
      { label: "Wallet", href: "/admin/wallet", icon: Wallet },
      { label: "Site Settings", href: "/admin/settings", icon: Settings },
    ],
  },
]

// ── Helper: get page label from pathname ──

function getPageLabel(pathname: string): string {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return item.label
      }
    }
  }
  return "Admin"
}

// ── Helper: build breadcrumbs ──

function buildBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }]
  const segments = pathname.replace("/admin", "").split("/").filter(Boolean)
  let path = "/admin"
  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`
    const isLast = i === segments.length - 1
    // Try to find a label from nav items
    const navItem = navGroups.flatMap(g => g.items).find(n => n.href === path)
    const label = navItem?.label || segments[i].charAt(0).toUpperCase() + segments[i].slice(1)
    crumbs.push(isLast ? { label } : { label, href: path })
  }
  return crumbs
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, role, loading: authLoading, logout: authLogout } = useAuth()
  const { can } = usePermissions()

  // Sidebar state
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Collapsed groups — persisted to localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("admin-nav-collapsed-groups")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Dark mode
  const [darkMode, setDarkMode] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Auth guard ──
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }
    if (!can("admin", "access")) {
      router.push("/")
      return
    }
  }, [authLoading, user, can, router])

  // ── Dark mode initialization ──
  useEffect(() => {
    const saved = localStorage.getItem("admin-theme")
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add("dark")
        localStorage.setItem("admin-theme", "dark")
      } else {
        document.documentElement.classList.remove("dark")
        localStorage.setItem("admin-theme", "light")
      }
      return next
    })
  }, [])

  // ── Persist collapsed groups ──
  useEffect(() => {
    try {
      localStorage.setItem("admin-nav-collapsed-groups", JSON.stringify(collapsedGroups))
    } catch { /* ignore */ }
  }, [collapsedGroups])

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev =>
      prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title]
    )
  }

  // ── Close mobile drawer on navigation ──
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // ── Close search on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Search results ──
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return navGroups.flatMap(g => g.items).filter(item =>
      item.label.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [searchQuery])

  // ── Breadcrumbs ──
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname])
  const pageLabel = useMemo(() => getPageLabel(pathname), [pathname])

  const logout = () => {
    authLogout()
  }

  // ── Active nav check: startsWith for nested route support ──
  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname === href || pathname.startsWith(href + "/")
  }

  if (authLoading || !user || !can("admin", "access")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          flex flex-col transition-all duration-300 z-50
          fixed inset-y-0 left-0
          ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}
          lg:relative lg:translate-x-0
          ${collapsed ? "lg:w-16" : "lg:w-64"}
        `}
      >
        {/* Brand + toggle */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
          {!collapsed && (
            <Link href="/admin" className="text-lg font-bold text-primary-700 dark:text-primary-600">
              Admin
            </Link>
          )}
          {collapsed && (
            <Link href="/admin" className="text-lg font-bold text-primary-700 dark:text-primary-600 mx-auto">
              A
            </Link>
          )}
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded lg:hidden"
          >
            <X size={18} />
          </button>
          {/* Collapse toggle on desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hidden lg:block"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups.includes(group.title)
            // Check if any item in this group is active
            const hasActive = group.items.some(item => isActive(item.href))

            return (
              <div key={group.title} className="mb-1">
                {/* Group header — hidden when sidebar collapsed on desktop */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className={`
                      w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold tracking-wider uppercase
                      ${hasActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}
                      hover:text-gray-600 dark:hover:text-gray-300 transition
                    `}
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                )}

                {/* Group items */}
                {(!isGroupCollapsed || collapsed) && group.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition text-sm
                        ${active
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                        }
                        ${collapsed ? "justify-center mx-1 px-2" : ""}
                      `}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={20} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  )
                })}

                {/* Collapsed count indicator when group is collapsed */}
                {isGroupCollapsed && !collapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="flex items-center gap-2 px-4 py-1.5 mx-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  >
                    <ChevronRightIcon size={10} />
                    <span>{group.items.length} items</span>
                  </button>
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={logout}
            className={`flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition text-sm ${
              collapsed ? "justify-center" : ""
            }`}
            title="Logout"
          >
            <LogOut size={20} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6">
          {/* Left: mobile menu + breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1 text-xs min-w-0 overflow-hidden">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <ChevronRightIcon size={10} className="text-gray-300 dark:text-gray-600" />}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-gray-900 dark:text-gray-100 font-semibold truncate">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          {/* Right: search + dark toggle + user */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <div ref={searchRef} className="relative">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5 w-48 lg:w-64">
                <Search size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 w-full"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchOpen(false) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Search dropdown */}
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
                  {searchResults.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setSearchQuery(""); setSearchOpen(false) }}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <item.icon size={16} className="text-gray-400 dark:text-gray-500" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User info */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.firstName} {user?.lastName}</span>
              <span
                className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs rounded-full font-medium uppercase"
                style={role?.color ? { backgroundColor: role.color + '20', color: role.color } : undefined}
              >
                {role?.label || user?.role}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}