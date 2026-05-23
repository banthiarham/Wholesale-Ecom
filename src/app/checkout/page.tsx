"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, CreditCard, Tag } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Header from "@/components/layout/Header"

interface CartItem {
  id: string; quantity: number; unitPrice: number;
  product: { id: string; title: string; handle: string; thumbnail: string | null; sku: string | null; moq: number }
}

interface CartData {
  cart: { id: string; items: CartItem[] }
  totals: { subtotal: number; itemCount: number; tax: number; shipping: number; total: number }
}

export default function CheckoutPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [address, setAddress] = useState({ street: "", city: "", state: "", zip: "", country: "India" })
  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponError, setCouponError] = useState("")

  useEffect(() => {
    fetch("/api/cart", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.cart?.items?.length > 0) setCart(data)
        setLoading(false)
      })
  }, [])

  const applyCoupon = async () => {
    if (!couponCode || !cart) return
    setCouponError("")
    try {
      const res = await fetch("/api/pricing/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, subtotal: cart.totals.subtotal }),
      })
      const result = await res.json()
      if (result.valid) {
        setCouponDiscount(result.discountAmount)
      } else {
        setCouponDiscount(0)
        setCouponError(result.message)
      }
    } catch (err) {
      setCouponError("Failed to validate coupon")
    }
  }

  const placeOrder = async () => {
    if (!cart) return
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    setPlacing(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cartId: cart.cart.id,
          shippingAddress: address,
          couponCode: couponCode || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        alert("Order placed successfully!")
        router.push(`/orders/${data.order.id}`)
      } else {
        alert(data.message || "Failed to place order")
      }
    } catch (err) {
      alert("Something went wrong")
    } finally {
      setPlacing(false)
    }
  }

  const totals = cart?.totals ?? { subtotal: 0, itemCount: 0, tax: 0, shipping: 0, total: 0 }
  const finalTotal = totals.total - couponDiscount

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
  if (!cart || cart.cart.items.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <Header />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <Link href="/products" className="text-primary-600 hover:underline">Continue Shopping</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/cart" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to cart</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="text-primary-600" size={20} />
                <h2 className="font-semibold">Shipping Address</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" placeholder="Street" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                <input type="text" placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                <input type="text" placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                <input type="text" placeholder="ZIP Code" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="text-primary-600" size={20} />
                <h2 className="font-semibold">Payment Method</h2>
              </div>
              <p className="text-gray-600 text-sm">Cash on Delivery (COD) is currently available. Online payment integration coming soon.</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm mb-4">
                {cart.cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="text-gray-600">{item.product.title} x{item.quantity}</span>
                    <span className="font-medium">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <hr className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (18% GST)</span>
                  <span className="font-medium">{formatPrice(totals.tax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">{totals.shipping > 0 ? formatPrice(totals.shipping) : <span className="text-green-600">Free</span>}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Coupon ({couponCode.toUpperCase()})</span>
                    <span className="font-medium text-green-600">-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                  onClick={applyCoupon}
                  disabled={!couponCode}
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition disabled:opacity-50"
                >
                  <Tag size={16} />
                </button>
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}

              <hr className="my-4" />
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-xl font-bold text-primary-700">{formatPrice(finalTotal)}</span>
              </div>
              <button onClick={placeOrder} disabled={placing} className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                {placing ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
