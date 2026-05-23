"use client"

import Link from "next/link"
import { ShoppingCart, User, LogOut, Menu } from "lucide-react"
import { useEffect, useState } from "react"

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setUser(data.user)
        })
        .catch(() => localStorage.removeItem("token"))
    }
  }, [])

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
    window.location.href = "/"
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary-700">WholesaleX Pro</Link>

        <nav className="hidden md:flex gap-6 items-center">
          <Link href="/products" className="text-gray-600 hover:text-primary-600 transition">Products</Link>
          <Link href="/categories" className="text-gray-600 hover:text-primary-600 transition">Categories</Link>
          {user && <Link href="/orders" className="text-gray-600 hover:text-primary-600 transition">My Orders</Link>}
          <Link href="/rfqs" className="text-gray-600 hover:text-primary-600 transition">RFQs</Link>
          <Link href="/catalogs" className="text-gray-600 hover:text-primary-600 transition">Catalogs</Link>
          {user && <Link href="/loyalty" className="text-gray-600 hover:text-primary-600 transition">Loyalty</Link>}
          {user && <Link href="/notifications" className="text-gray-600 hover:text-primary-600 transition relative">Notifications</Link>}
          {user?.role === 'VENDOR' && <Link href="/vendor/dashboard" className="text-gray-600 hover:text-primary-600 transition">Vendor</Link>}
          <Link href="/cart" className="text-gray-600 hover:text-primary-600 transition">
            <ShoppingCart size={20} />
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{user.firstName}</span>
              <button onClick={logout} className="text-gray-400 hover:text-red-500 transition"><LogOut size={18} /></button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link href="/login" className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition">Sign In</Link>
              <Link href="/register" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Sign Up</Link>
            </div>
          )}
        </nav>

        <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-gray-600">
          <Menu size={24} />
        </button>
      </div>

      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <Link href="/products" className="block text-gray-600">Products</Link>
          <Link href="/cart" className="block text-gray-600">Cart</Link>
          {user ? (
            <>
              <Link href="/orders" className="block text-gray-600">My Orders</Link>
              <button onClick={logout} className="block text-red-500">Sign Out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-primary-600">Sign In</Link>
              <Link href="/register" className="block text-primary-600">Sign Up</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
