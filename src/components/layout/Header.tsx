"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ShoppingCart,
  User,
  LogOut,
  Menu,
  Globe,
  Search,
  X,
  ChevronDown,
  Package,
  ShoppingBag,
  FileText,
  BarChart3,
  Heart,
  Bell,
  Settings,
  Home,
  ChevronRight,
  MapPin,
  RotateCcw,
  Star,
  Shield,
  Layers,
  PackageOpen,
  Wallet,
  BookOpen,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { useAuth, usePermissions } from "@/lib/auth"
import { getCartSessionId, getContrastTextColor } from "@/lib/utils"
import { useCartDrawer } from "@/components/ui/CartDrawer"

export default function Header() {
  const { user, role, loading: authLoading, logout: authLogout } = useAuth()
  const { can } = usePermissions()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { locale, setLocale, t } = useTranslation()
  const pathname = usePathname()
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const logoUrl = useSetting("logoUrl", "")
  const { openCartDrawer } = useCartDrawer()

  const fetchCartCount = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    fetch("/api/cart", { headers })
      .then((r) => r.json())
      .then((d) => setCartCount(d.totals?.itemCount ?? 0))
      .catch((err) => { console.error("Failed to fetch cart count:", err) })
  }

  useEffect(() => {
    fetchCartCount()
    window.addEventListener("cart-updated", fetchCartCount)
    window.addEventListener("auth-change", fetchCartCount)
    return () => {
      window.removeEventListener("cart-updated", fetchCartCount)
      window.removeEventListener("auth-change", fetchCartCount)
    }
  }, [])

  useEffect(() => {
    setMobileMenu(false)
    setUserMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const logout = () => {
    authLogout()
  }

  const toggleLang = () => setLocale(locale === "en" ? "hi" : "en")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`
    }
  }

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/"
    return pathname === path || pathname.startsWith(path + "/")
  }

  const breadcrumbItems = pathname === "/" ? [] : (() => {
    const items = [{ href: "/", label: t("nav.home"), icon: Home }]
    const segments = pathname.split("/").filter(Boolean)
    const labelMap: Record<string, string> = {
      products: t("nav.products"),
      categories: t("nav.categories"),
      rfqs: t("nav.rfqs"),
      cart: t("nav.cart"),
      orders: t("nav.orders"),
      loyalty: t("nav.loyalty"),
      notifications: t("nav.notifications"),
      analytics: t("nav.analytics"),
      vendor: t("nav.vendor"),
      admin: "Admin",
      login: t("nav.signin"),
      register: t("nav.signup"),
      checkout: "Checkout",
      new: "New",
      dashboard: "Dashboard",
      inventory: "Inventory",
      bulk: "Bulk",
    }
    let currentPath = ""
    for (let i = 0; i < segments.length; i++) {
      currentPath += `/${segments[i]}`
      const label = labelMap[segments[i]] || segments[i].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      items.push({ href: currentPath, label, icon: null as any })
    }
    return items
  })()

  const navLinks = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/products", label: t("nav.products"), icon: Package },
    { href: "/categories", label: t("nav.categories"), icon: BarChart3 },
    { href: "/packages", label: "Packages", icon: Layers },
    { href: "/rfqs", label: t("nav.rfqs"), icon: FileText },
    { href: "/bulk-orders", label: "Bulk Orders", icon: PackageOpen },
  ]

  // The account's underlying legacy role enum (always BUYER/VENDOR/DISTRIBUTOR/ADMIN,
  // regardless of which custom dynamic role/tier — e.g. "Wholesaler", "Premium Buyer" —
  // is layered on top via roleRel). Used below so the Buyer Account "My Orders" link is
  // guaranteed to show for every buyer even if the role-permissions fetch (read:orders)
  // hasn't resolved yet, or the account's custom role has no permissions assigned — the
  // link itself always points at the existing, unchanged /orders page.
  const isBuyerAccount = user?.role === "BUYER"

  const userLinks = user
    ? [
        ...(can("admin", "access")
          ? [{ href: "/admin", label: "Admin", icon: Settings }]
          : []),
        { href: "/orders", label: t("nav.orders"), icon: ShoppingBag, permission: "read:orders" },
        { href: "/bulk-orders/my-requests", label: "Bulk Quote Requests", icon: PackageOpen },
        { href: "/wishlist", label: "Wishlist", icon: Heart },
        { href: "/account/profile", label: "My Profile", icon: User },
        { href: "/account/role-request", label: "Role & Access", icon: Shield },
        { href: "/account/addresses", label: "Addresses", icon: MapPin },
        { href: "/account/returns", label: "Returns", icon: RotateCcw },
        { href: "/account/reviews", label: "My Reviews", icon: Star },
        { href: "/loyalty", label: t("nav.loyalty"), icon: Heart },
        { href: "/wallet", label: "Wallet", icon: Wallet },
        { href: "/account/ledger", label: "Ledger", icon: BookOpen },
        { href: "/notifications", label: t("nav.notifications"), icon: Bell },
      ].filter((link) => {
        if (!("permission" in link)) return true
        if (link.href === "/orders" && isBuyerAccount) return true
        const parts = (link as any).permission.split(":")
        return can(parts[0], parts[1])
      })
    : []

  if (pathname?.startsWith("/admin")) return null

  return (
    <header className="sticky top-0 z-50 shadow-md">
      {/* Solid brand-color bar — Flipkart's signature always-on-blue header */}
      <div className="bg-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-6 h-14 lg:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-7 lg:h-8 w-auto object-contain brightness-0 invert" />
              ) : (
                <>
                  <div className="w-8 h-8 lg:w-9 lg:h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <Package size={17} className="text-primary-700" />
                  </div>
                  <span className="hidden sm:block text-lg lg:text-xl font-bold text-white tracking-tight leading-none">
                    {siteName.replace(/(.)(.*)$/, (_, first, rest) => `${first}${rest.slice(0, -1)}`)}
                    <span className="text-amber-300">{siteName.slice(-1)}</span>
                  </span>
                </>
              )}
            </Link>

            {/* Search — always visible, Flipkart's signature centerpiece */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, categories, vendors..."
                className="w-full pl-4 pr-11 py-2.5 rounded-md border-0 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-0 top-0 h-full px-3.5 flex items-center justify-center text-primary-700 hover:text-primary-800 transition-colors"
              >
                <Search size={18} />
              </button>
            </form>

            {/* Right actions */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto sm:ml-0">
              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="hidden md:flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-white/85 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <Globe size={16} />
                {locale === "en" ? "HI" : "EN"}
              </button>

              {/* Cart */}
              <button
                onClick={openCartDrawer}
                className="relative flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-all duration-200"
                aria-label="Open cart"
              >
                <ShoppingCart size={19} />
                <span className="hidden lg:inline text-sm font-semibold">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-0.5 min-w-[18px] h-[18px] px-1 bg-amber-400 text-primary-900 text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>

              {/* Auth */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-1.5 pl-1.5 pr-1 sm:pr-2 py-1 rounded-lg hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center ring-1 ring-white/40">
                      <span className="text-sm font-semibold text-primary-700">
                        {user.firstName?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-white max-w-[100px] truncate">
                      {user.firstName}
                    </span>
                    <ChevronDown size={14} className={`hidden sm:block text-white/70 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-2.5 w-60 bg-white rounded-2xl border border-gray-100 py-2 animate-fade-in-up"
                      style={{ boxShadow: "var(--shadow-elevated)" }}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md" style={{ backgroundColor: role?.color || '#6B7280', color: getContrastTextColor(role?.color || '#6B7280') }}>
                          {role?.label || user.role}
                        </span>
                      </div>
                      {[...userLinks, { href: "/analytics", label: t("nav.analytics"), icon: BarChart3 }].map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition-colors duration-150"
                        >
                          <link.icon size={16} className="text-gray-400" />
                          {link.label}
                        </Link>
                      ))}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={logout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors duration-150"
                        >
                          <LogOut size={16} />
                          {t("nav.signout")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-semibold text-primary-700 bg-white rounded-md hover:bg-primary-50 transition-all duration-200"
                  >
                    {t("nav.signin")}
                  </Link>
                  <Link
                    href="/register"
                    className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-white border border-white/40 rounded-md hover:bg-white/10 transition-all duration-200"
                  >
                    {t("nav.signup")}
                  </Link>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-all duration-200"
              >
                {mobileMenu ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile search — full-width row under the top bar */}
          <form onSubmit={handleSearch} className="sm:hidden pb-2.5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products..."
              className="w-full pl-4 pr-11 py-2.5 rounded-md border-0 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
            />
            <button type="submit" aria-label="Search" className="absolute right-3 top-1/2 -translate-y-1/2 -mt-[5px] text-primary-700">
              <Search size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Category quick-links strip — dense secondary nav row, Flipkart-style */}
      <div className="hidden lg:block bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-0.5">
            {[...navLinks, ...userLinks.slice(0, 2)].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive(link.href) ? "text-primary-700" : "text-gray-600 hover:text-primary-700"
                }`}
              >
                {link.label}
                <span
                  className={`absolute left-3.5 right-3.5 -bottom-[1px] h-0.5 rounded-full bg-primary-700 origin-left transition-transform duration-200 ${
                    isActive(link.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenu && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive(link.href)
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <link.icon size={18} className="text-gray-400" />
                {link.label}
              </Link>
            ))}
            {userLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive(link.href)
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <link.icon size={18} className="text-gray-400" />
                {link.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <button
                onClick={toggleLang}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <Globe size={18} className="text-gray-400" />
                {locale === "en" ? t("language.hindi") : t("language.english")}
              </button>
              {user ? (
                <button
                  onClick={logout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition"
                >
                  <LogOut size={18} />
                  {t("nav.signout")}
                </button>
              ) : (
                <div className="flex gap-2 mt-2 px-3">
                  <Link href="/login" className="flex-1 text-center px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition">
                    {t("nav.signin")}
                  </Link>
                  <Link href="/register" className="flex-1 text-center px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                    {t("nav.signup")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb bar */}
      {breadcrumbItems.length > 1 && (
        <div className="border-t border-gray-100 bg-gray-50/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-1.5 text-sm overflow-x-auto">
            {breadcrumbItems.map((item, i) => {
              const isLast = i === breadcrumbItems.length - 1
              return (
                <span key={item.href} className="flex items-center gap-1.5 shrink-0">
                  {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
                  {isLast ? (
                    <span className="text-gray-900 font-medium">{item.label}</span>
                  ) : (
                    <Link href={item.href} className="text-gray-500 hover:text-primary-600 transition-colors duration-150 flex items-center gap-1">
                      {item.icon && <item.icon size={14} />}
                      {item.label}
                    </Link>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}