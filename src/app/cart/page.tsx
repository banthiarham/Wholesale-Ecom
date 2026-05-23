"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ShoppingCart, ArrowLeft } from "lucide-react"
import CartItemCard from "@/components/cart/CartItemCard"
import CartSummary from "@/components/cart/CartSummary"
import { getCartSessionId } from "@/lib/utils"

interface CartItem {
  id: string
  quantity: number
  unitPrice: number
  product: {
    id: string
    title: string
    handle: string
    sku: string | null
    thumbnail: string | null
    moq: number
    inventoryQuantity: number
  }
}

interface Totals {
  subtotal: number
  itemCount: number
  tax: number
  shipping: number
  couponDiscount: number
  couponApplied: string | null
  total: number
}

interface CartData {
  cart: { id: string; items: CartItem[] }
  totals: Totals
}

export default function CartPage() {
  const [data, setData] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store", headers: { "x-session-id": getCartSessionId() } })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const handleUpdate = async (itemId: string, quantity: number) => {
    setUpdating(true)
    try {
      const res = await fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() }, body: JSON.stringify({ itemId, quantity }) })
      if (res.ok) { const json = await res.json(); setData(json); recalcCoupon(json.totals.subtotal) }
    } catch (err) { console.error(err) } finally { setUpdating(false) }
  }

  const handleRemove = async (itemId: string) => {
    setUpdating(true)
    try {
      const res = await fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() }, body: JSON.stringify({ itemId }) })
      if (res.ok) { const json = await res.json(); setData(json); recalcCoupon(json.totals.subtotal) }
    } catch (err) { console.error(err) } finally { setUpdating(false) }
  }

  const recalcCoupon = (subtotal: number) => {
    if (couponCode && data) {
      fetch("/api/cart/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
        body: JSON.stringify({ code: couponCode }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.valid) {
            setCouponDiscount(result.discountAmount)
          } else {
            setCouponCode(null)
            setCouponDiscount(0)
            setCouponError(result.message)
          }
        })
    }
  }

  const handleApplyCoupon = async (code: string) => {
    setCouponLoading(true)
    setCouponError("")
    try {
      const res = await fetch("/api/cart/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
        body: JSON.stringify({ code }),
      })
      const result = await res.json()
      if (result.valid) {
        setCouponCode(code.toUpperCase())
        setCouponDiscount(result.discountAmount)
      } else {
        setCouponError(result.message)
      }
    } catch (err) {
      setCouponError("Failed to apply coupon")
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setCouponCode(null)
    setCouponDiscount(0)
    setCouponError("")
  }

  const totals = data?.totals ?? { subtotal: 0, itemCount: 0, tax: 0, shipping: 0, total: 0 }
  const adjustedTotal = totals.total - couponDiscount

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  if (!data || data.cart.items.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <ShoppingCart size={64} className="text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
      <Link href="/products" className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
        <ArrowLeft size={18} /> Continue Shopping
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <Link href="/" className="text-gray-600 hover:text-primary-600">Home</Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {data.cart.items.map((item) => (
              <CartItemCard key={item.id} item={item} onUpdate={handleUpdate} onRemove={handleRemove} updating={updating} />
            ))}
          </div>
          <div className="lg:col-span-1">
            <CartSummary
              subtotal={totals.subtotal}
              itemCount={totals.itemCount}
              tax={totals.tax}
              shipping={totals.shipping}
              couponDiscount={couponDiscount}
              couponCode={couponCode}
              total={adjustedTotal}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              couponLoading={couponLoading}
              couponError={couponError}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
