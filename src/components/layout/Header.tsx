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
  GitCompare,
  Star,
  Shield,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { useAuth, usePermissions } from "@/lib/auth"
import { getCartSessionId } from "@/lib/utils"

export default function Header() {
  const { user, role, loading: authLoading, logout: authLogout } = useAuth()
  const { can } = usePermissions()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { locale, setLocale, t } = useTranslation()
  const pathname = usePathname()
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const logoUrl = useSetting("logoUrl", "")

  const fetchCartCount = () => {
    fetch("/api/cart", { headers: { "x-session-id": getCartSessionId() } })
      .then((r) => r.json())
      .then((d) => setCartCount(d.totals?.itemCount ?? 0))
      .catch(() => {})
  }

  useEffect(() => {
    fetchCartCount()
    window.addEventListener("cart-updated", () => fetchCartCount())
    return () => {
      window.removeEventListener("cart-updated", () => fetchCartCount())
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMobileMenu(false)
    setSearchOpen(false)
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
      catalogs: t("nav.catalogs"),
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
    { href: "/rfqs", label: t("nav.rfqs"), icon: FileText },
    { href: "/catalogs", label: t("nav.catalogs"), icon: FileText },
  ]

  const userLinks = user
    ? [
        ...(can("admin", "access")
          ? [{ href: "/admin", label: "Admin", icon: Settings }]
          : []),
        { href: "/orders", label: t("nav.orders"), icon: ShoppingBag, permission: "orders:view" },
        { href: "/wishlist", label: "Wishlist", icon: Heart },
        { href: "/account/role-request", label: "Role & Access", icon: Shield },
        { href: "/account/addresses", label: "Addresses", icon: MapPin },
        { href: "/account/returns", label: "Returns", icon: RotateCcw },
        { href: "/account/reviews", label: "My Reviews", icon: Star },
        { href: "/compare", label: "Compare", icon: GitCompare },
        { href: "/loyalty", label: t("nav.loyalty"), icon: Heart },
        { href: "/notifications", label: t("nav.notifications"), icon: Bell },
      ].filter((link) => {
        if (!("permission" in link)) return true
        const parts = (link as any).permission.split(":")
        return can(parts[0], parts[1])
      })
    : []

  if (pathname?.startsWith("/admin")) return null

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-md" : "border-b border-gray-100"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
            ) : (
              <>
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Package size={18} className="text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">
                  {siteName.replace(/(.)(.*)$/, (_, first, rest) => `${first}${rest.slice(0, -1)}`)}
                  <span className="text-primary-600">{siteName.slice(-1)}</span>
                </span>
              </>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(link.href)
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {userLinks.slice(0, 2).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(link.href)
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search toggle */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition"
            >
              <Globe size={16} />
              {locale === "en" ? "HI" : "EN"}
            </button>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {/* Auth */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-50 transition"
                >
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                    {user.firstName}
                  </span>
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary-600">
                      {user.firstName?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-lg py-2 animate-fade-in-up">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold uppercase rounded text-white" style={{ backgroundColor: role?.color || '#6B7280' }}>
                        {role?.label || user.role}
                      </span>
                    </div>
                    {[...userLinks, { href: "/analytics", label: t("nav.analytics"), icon: BarChart3 }].map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition"
                      >
                        <link.icon size={16} className="text-gray-400" />
                        {link.label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={logout}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
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
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition"
                >
                  {t("nav.signin")}
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  {t("nav.signup")}
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50 transition"
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Search bar (expandable) */}
        {searchOpen && (
          <div className="pb-3 animate-fade-in-up">
            <form onSubmit={handleSearch} className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, categories, vendors..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </form>
          </div>
        )}
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
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-1.5 text-sm overflow-x-auto">
            {breadcrumbItems.map((item, i) => {
              const isLast = i === breadcrumbItems.length - 1
              return (
                <span key={item.href} className="flex items-center gap-1.5 shrink-0">
                  {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
                  {isLast ? (
                    <span className="text-gray-900 font-medium">{item.label}</span>
                  ) : (
                    <Link href={item.href} className="text-gray-400 hover:text-primary-600 transition flex items-center gap-1">
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