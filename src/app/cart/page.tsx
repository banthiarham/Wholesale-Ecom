"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ShoppingCart, ArrowLeft, Package, ArrowRight } from "lucide-react"
import CartItemCard from "@/components/cart/CartItemCard"
import CartSummary from "@/components/cart/CartSummary"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

interface TierPrice { minQty: number; maxQty: number | null; price: string }

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
    unitPrice: string
    compareAtPrice: string | null
    tierPrices: TierPrice[]
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
  const { t } = useTranslation()

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

  const totalSavings = (data?.cart.items ?? []).reduce((sum, item) => {
    const listPrice = Number(item.product.unitPrice)
    const effectivePrice = Number(item.unitPrice)
    return sum + (listPrice - effectivePrice) * item.quantity
  }, 0)

  // Parse pricing metadata to show discount breakdown
  const discountBreakdown = (data?.cart.items ?? []).reduce((acc, item) => {
    const meta = (item as any).metadata?.pricing
    if (!meta) return acc
    if (meta.contractPrice && meta.contractPrice < meta.basePrice) {
      acc.contract = (acc.contract || 0) + (meta.basePrice - meta.contractPrice) * item.quantity
    }
    if (meta.seasonalDiscount > 0) {
      acc.seasonal = (acc.seasonal || 0) + meta.seasonalDiscount * item.quantity
      if (meta.appliedDiscounts?.length) {
        meta.appliedDiscounts.forEach((d: string) => { if (!acc.labels.includes(d)) acc.labels.push(d) })
      }
    }
    return acc
  }, { contract: 0, seasonal: 0, labels: [] as string[] } as { contract: number; seasonal: number; labels: string[] })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  if (!data || data.cart.items.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center max-w-md">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <ShoppingCart size={36} className="text-gray-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("cart.empty")}</h1>
        <p className="text-sm text-gray-500 mb-6">Start adding products to see your wholesale savings here.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/products" className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
            <Package size={18} /> Browse Products
          </Link>
          <Link href="/" className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition">
            <ArrowLeft size={18} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("cart.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{totals.itemCount} item{totals.itemCount !== 1 ? "s" : ""} in your cart</p>
          </div>
          {totalSavings > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-lg">
              <span className="text-sm text-green-700 font-medium">Total savings:</span>
              <span className="text-sm font-bold text-green-700">{formatPrice(totalSavings)}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {data.cart.items.map((item) => (
              <CartItemCard key={item.id} item={item} onUpdate={handleUpdate} onRemove={handleRemove} updating={updating} />
            ))}
            <Link href="/products" className="inline-flex items-center gap-2 text-sm text-primary-600 font-medium hover:gap-3 transition-all mt-2">
              <ArrowLeft size={16} /> Continue Shopping
            </Link>
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
              totalSavings={totalSavings}
              contractSavings={discountBreakdown.contract}
              seasonalSavings={discountBreakdown.seasonal}
              discountLabels={discountBreakdown.labels}
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