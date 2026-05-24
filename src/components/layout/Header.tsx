"use client"

import Link from "next/link"
import { ShoppingCart, User, LogOut, Menu, Globe, Home } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const { locale, setLocale, t } = useTranslation()

  const fetchUser = () => {
    const token = localStorage.getItem("token")
    if (!token) { setUser(null); return }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else setUser(null)
      })
      .catch(() => { setUser(null); localStorage.removeItem("token") })
  }

  useEffect(() => {
    fetchUser()
    const handler = (e: any) => { setUser(e.detail || null) }
    window.addEventListener("auth-change", handler)
    return () => window.removeEventListener("auth-change", handler)
  }, [])

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
    window.location.href = "/"
  }

  const toggleLang = () => {
    setLocale(locale === "en" ? "hi" : "en")
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary-700">WholesaleX Pro</Link>

        <nav className="hidden md:flex gap-6 items-center">
          <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 transition">
            <Home size={18} /> {t("nav.home")}
          </Link>
          <Link href="/products" className="text-gray-600 hover:text-primary-600 transition">{t("nav.products")}</Link>
          <Link href="/categories" className="text-gray-600 hover:text-primary-600 transition">{t("nav.categories")}</Link>
          {user && <Link href="/orders" className="text-gray-600 hover:text-primary-600 transition">{t("nav.orders")}</Link>}
          <Link href="/rfqs" className="text-gray-600 hover:text-primary-600 transition">{t("nav.rfqs")}</Link>
          <Link href="/catalogs" className="text-gray-600 hover:text-primary-600 transition">{t("nav.catalogs")}</Link>
          {user && <Link href="/loyalty" className="text-gray-600 hover:text-primary-600 transition">{t("nav.loyalty")}</Link>}
          {user && <Link href="/notifications" className="text-gray-600 hover:text-primary-600 transition relative">{t("nav.notifications")}</Link>}
          {user?.role === 'VENDOR' && <Link href="/vendor/dashboard" className="text-gray-600 hover:text-primary-600 transition">{t("nav.vendor")}</Link>}
          {user?.role === 'ADMIN' && <Link href="/admin" className="text-gray-600 hover:text-primary-600 transition">Admin</Link>}
          <Link href="/cart" className="text-gray-600 hover:text-primary-600 transition">
            <ShoppingCart size={20} />
          </Link>
          <button onClick={toggleLang} className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600 transition">
            <Globe size={16} />
            {locale === "en" ? t("language.hindi") : t("language.english")}
          </button>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{user.firstName}</span>
              <button onClick={logout} className="text-gray-400 hover:text-red-500 transition"><LogOut size={18} /></button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link href="/login" className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition">{t("nav.signin")}</Link>
              <Link href="/register" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">{t("nav.signup")}</Link>
            </div>
          )}
        </nav>

        <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-gray-600">
          <Menu size={24} />
        </button>
      </div>

      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <Link href="/" className="block text-gray-600">{t("nav.home")}</Link>
          <Link href="/products" className="block text-gray-600">{t("nav.products")}</Link>
          <Link href="/cart" className="block text-gray-600">{t("nav.cart")}</Link>
          <button onClick={toggleLang} className="block text-primary-600">
            {locale === "en" ? t("language.hindi") : t("language.english")}
          </button>
          {user ? (
            <>
              <Link href="/orders" className="block text-gray-600">{t("nav.orders")}</Link>
              <button onClick={logout} className="block text-red-500">{t("nav.signout")}</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-primary-600">{t("nav.signin")}</Link>
              <Link href="/register" className="block text-primary-600">{t("nav.signup")}</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
