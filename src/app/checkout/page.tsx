"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, CreditCard, Receipt, Tag, Smartphone, Banknote, Shield, Gift, AlertTriangle, Percent, Layers, Truck, Wallet } from "lucide-react"
import { formatPrice, getCartSessionId, COUNTRIES } from "@/lib/utils"
import { INDIAN_STATES, lookupPincode } from "@/lib/indian-address"
import { useStorefrontRules } from "@/lib/rules"

interface CartItem {
  id: string; quantity: number; unitPrice: number;
  product: { id: string; title: string; handle: string; thumbnail: string | null; sku: string | null; moq: number; unitPrice: string; compareAtPrice: string | null; tierPrices: { minQty: number; maxQty: number | null; price: string }[]; category?: { id: string; name: string; handle: string } }
}

interface CartData {
  cart: { id: string; items: CartItem[] }
  totals: { subtotal: number; itemCount: number; tax: number; shipping: number; total: number }
}

interface EnabledGateway {
  id: string
  provider: string
  label: string
  description: string | null
  isDefault: boolean
  testMode: boolean
  gatewayUrl?: string | null
}

const PROVIDER_LABELS: Record<string, string> = {
  CCAVENUE: "CCAvenue",
  RAZORPAY: "Razorpay",
  STRIPE: "Stripe",
  PAYU: "PayU",
}

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  CCAVENUE: "Credit/Debit card, UPI, NetBanking, Wallets",
  RAZORPAY: "Cards, UPI, Wallets, NetBanking",
  STRIPE: "International cards & Apple/Google Pay",
  PAYU: "Cards, UPI, NetBanking",
}

type PaymentMethod = "COD" | "ONLINE" | "WALLET"

export default function CheckoutPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [address, setAddress] = useState({ fullName: "", phone: "", email: "", street: "", apartment: "", landmark: "", city: "", state: "", zip: "", country: "India" })
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true)
  const [billingAddress, setBillingAddress] = useState({ fullName: "", phone: "", email: "", street: "", apartment: "", landmark: "", city: "", state: "", zip: "", country: "India" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [billingErrors, setBillingErrors] = useState<Record<string, string>>({})
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [billingPincodeLoading, setBillingPincodeLoading] = useState(false)
  const [pincodeLocations, setPincodeLocations] = useState<{ name: string; district: string; state: string; block: string }[]>([])
  const [billingPincodeLocations, setBillingPincodeLocations] = useState<{ name: string; district: string; state: string; block: string }[]>([])
  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponError, setCouponError] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD")
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [gateways, setGateways] = useState<EnabledGateway[]>([])
  const [walletCreditInfo, setWalletCreditInfo] = useState<{ availableCredit: number; balance: number; creditLimit: number; outstanding: number; walletId: string; limitReached: boolean } | null>(null)
  const [redirectData, setRedirectData] = useState<{ url: string; method: string; params: Record<string, string> } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Evaluate dynamic rules for checkout
  const cartItemsForRules = useMemo(
    () => (cart?.cart.items ?? []).map((item) => ({
      id: item.product.id,
      categoryId: item.product.category?.id,
      unitPrice: Number(item.product.unitPrice),
    })),
    [cart?.cart.items]
  )
  const {
    productDiscounts, cartDiscount, paymentMethodDiscount, bogo,
    shipping, taxes, minimumOrderQuantities, maximumOrderQuantities,
    checkoutRestrictions, quantityDiscounts, extraCharges,
    availablePaymentMethods,
  } = useStorefrontRules(cartItemsForRules, undefined, {
    paymentMethod: paymentMethod === "COD" ? "COD" : selectedProvider || undefined,
  })

  // Build lookup maps
  const ruleProductDiscountMap = useMemo(() => {
    const m = new Map<string, { discountAmount: number; discountPercent: number; ruleName: string }>()
    for (const d of productDiscounts) m.set(d.productId, d)
    return m
  }, [productDiscounts])

  const qtyDiscountMap = useMemo(() => {
    const m = new Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>()
    for (const qd of quantityDiscounts) {
      if (qd.productId) m.set(qd.productId, qd)
    }
    return m
  }, [quantityDiscounts])

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    fetch("/api/cart", { cache: "no-store", headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.cart) setCart(data)
        setLoading(false)
      })
      .catch(() => { setLoading(false) })
    fetch("/api/payment-gateways/enabled")
      .then((res) => res.json())
      .then((data) => {
        const list: EnabledGateway[] = Array.isArray(data) ? data : data.gateways ?? []
        setGateways(list)
        if (list.length > 0) {
          const defaultGw = list.find((g) => g.isDefault)
          setSelectedProvider(defaultGw?.provider || list[0].provider)
        }
      })
      .catch(() => {})
    // Load wallet credit info if logged in
    if (token) {
      fetch("/api/wallets/me/credit-info", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.creditInfo) setWalletCreditInfo(data.creditInfo) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (redirectData && formRef.current) {
      formRef.current.submit()
    }
  }, [redirectData])

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

  const openRazorpayCheckout = (data: any) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => {
      const options: any = {
        key: data.keyId,
        order_id: data.providerOrderId,
        name: "WholesaleX",
        amount: data.extra?.amount,
        currency: data.extra?.currency || "INR",
        prefill: {
          name: data.extra?.customerName || "",
          email: data.extra?.customerEmail || "",
          contact: data.extra?.customerPhone || "",
        },
        handler: function (response: any) {
          const orderId = response.razorpay_order_id ? new URLSearchParams(window.location.search).get("orderId") || "" : ""
          router.push(`/orders/${orderId}?payment=success`)
        },
      }
      const rzp = new (window as any).Razorpay(options)
      rzp.on("payment.failed", function () { alert("Payment failed. Please try again."); setPlacing(false) })
      rzp.open()
    }
    document.body.appendChild(script)
  }

  const validateAddress = (addr: typeof address): Record<string, string> => {
    const errs: Record<string, string> = {}
    if (!addr.fullName.trim()) errs.fullName = "Full name is required"
    if (!addr.phone.trim()) errs.phone = "Phone number is required"
    else if (!/^\+?[\d\s-]{7,15}$/.test(addr.phone.trim())) errs.phone = "Enter a valid phone number"
    if (addr.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) errs.email = "Enter a valid email"
    if (!addr.street.trim()) errs.street = "Street address is required"
    if (!addr.city.trim()) errs.city = "City is required"
    if (!addr.state.trim()) errs.state = "State is required"
    if (!addr.zip.trim()) errs.zip = "ZIP/Postal code is required"
    else if (!/^[\dA-Za-z\s-]{3,10}$/.test(addr.zip.trim())) errs.zip = "Enter a valid ZIP/Postal code"
    if (!addr.country.trim()) errs.country = "Country is required"
    return errs
  }

  const handlePincodeLookup = async (pincode: string, isBilling: boolean) => {
    if (!/^\d{6}$/.test(pincode)) return
    if ((isBilling ? billingAddress : address).country !== "India") return
    const setLoading = isBilling ? setBillingPincodeLoading : setPincodeLoading
    const setLocations = isBilling ? setBillingPincodeLocations : setPincodeLocations
    setLoading(true)
    setLocations([])
    try {
      const result = await lookupPincode(pincode)
      if (result) {
        setLocations(result.locations)
        if (isBilling) {
          setBillingAddress((prev) => ({ ...prev, city: result.district, state: result.state }))
        } else {
          setAddress((prev) => ({ ...prev, city: result.district, state: result.state }))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const placeOrder = async () => {
    if (!cart) return
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    const shippingErrors = validateAddress(address)
    if (Object.keys(shippingErrors).length > 0) {
      setErrors(shippingErrors)
      setPlacing(false)
      return
    }
    if (!billingSameAsShipping) {
      const bErrors = validateAddress(billingAddress)
      if (Object.keys(bErrors).length > 0) {
        setBillingErrors(bErrors)
        setPlacing(false)
        return
      }
    }
    setErrors({})
    setBillingErrors({})

    setPlacing(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cartId: cart.cart.id,
          shippingAddress: address,
          billingAddress: billingSameAsShipping ? undefined : billingAddress,
          couponCode: couponCode || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.message || "Failed to place order")
        setPlacing(false)
        return
      }

      const orderId = data.order.id

      if (paymentMethod === "WALLET") {
        // Pay from wallet — debit the wallet and mark payment
        const total = cart.totals.total - couponDiscount
        const walletRes = await fetch("/api/wallets/debit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            walletId: walletCreditInfo!.walletId,
            amount: total,
            description: `Payment for order ${data.order.orderNumber || orderId}`,
            referenceId: orderId,
          }),
        })
        if (!walletRes.ok) {
          const walletErr = await walletRes.json()
          alert(walletErr.message || "Wallet payment failed. Please try another payment method.")
          setPlacing(false)
          return
        }
        // Record wallet payment
        await fetch(`/api/payments/initiate/${orderId}?provider=WALLET&returnUrl=${encodeURIComponent(`${window.location.origin}/orders/${orderId}`)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
        alert("Order placed and paid from wallet!")
        router.push(`/orders/${orderId}`)
        return
      }

      if (paymentMethod === "COD") {
        alert("Order placed successfully!")
        router.push(`/orders/${orderId}`)
        return
      }

      const returnUrl = `${window.location.origin}/orders/${orderId}`
      const initRes = await fetch(
        `/api/payments/initiate/${orderId}?provider=${selectedProvider}&returnUrl=${encodeURIComponent(returnUrl)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      )
      const initData = await initRes.json()

      if (!initRes.ok) {
        alert(initData.message || "Failed to initiate payment. Please try COD or contact support.")
        setPlacing(false)
        return
      }

      if (selectedProvider === "STRIPE" && initData.redirectUrl) {
        window.location.href = initData.redirectUrl
        return
      }

      if (selectedProvider === "RAZORPAY" && initData.providerOrderId) {
        openRazorpayCheckout({ ...initData, orderId })
        return
      }

      if (initData.formData || initData.encRequest || initData.accessCode) {
        const params: Record<string, string> = {}
        let url = initData.gatewayUrl || ""
        if (initData.formData) {
          if (!url) url = initData.redirectUrl || ""
          Object.entries(initData.formData).forEach(([k, v]: [string, any]) => { params[k] = String(v) })
        } else if (initData.encRequest) {
          if (!url) url = initData.gatewayUrl || ""
          params.encRequest = initData.encRequest
          params.access_code = initData.accessCode
        }
        if (url) { setRedirectData({ url, method: "post", params }); return }
      }

      alert("Payment initiated but no redirect was received. Please check your order status.")
      router.push(`/orders/${orderId}`)
    } catch (err) {
      alert("Something went wrong")
      setPlacing(false)
    }
  }

  // Rule-based calculations
  const totals = cart?.totals ?? { subtotal: 0, itemCount: 0, tax: 0, shipping: 0, total: 0 }
  const ruleProductSavings = (cart?.cart.items ?? []).reduce((sum, item) => {
    const disc = ruleProductDiscountMap.get(item.product.id)
    if (!disc) return sum
    return sum + disc.discountAmount * item.quantity
  }, 0)
  const ruleCartSavings = cartDiscount?.discountAmount ?? 0
  const paymentSavings = paymentMethodDiscount?.discountAmount ?? 0
  const qtyDiscountSavings = (cart?.cart.items ?? []).reduce((sum, item) => {
    const qd = qtyDiscountMap.get(item.product.id)
    if (!qd) return sum
    const applicableTier = [...qd.tiers].sort((a, b) => b.minQty - a.minQty).find(t => item.quantity >= t.minQty)
    if (!applicableTier) return sum
    if (applicableTier.discountType === 'PERCENTAGE') return sum + (Number(item.unitPrice) * item.quantity * applicableTier.discountValue) / 100
    return sum + applicableTier.discountValue * item.quantity
  }, 0)
  const extraChargesTotal = extraCharges.reduce((sum, ec) => sum + ec.chargeAmount, 0)
  const ruleTaxTotal = taxes.reduce((sum, tax) => sum + (totals.subtotal * tax.taxRate) / 100, 0)
  const effectiveShipping = shipping ? shipping.cost : totals.shipping
  const finalTotal = Math.max(0, totals.subtotal - ruleProductSavings - ruleCartSavings - paymentSavings - qtyDiscountSavings - couponDiscount + extraChargesTotal + ruleTaxTotal + effectiveShipping)

  // Payment method filtering based on rules
  const totalCartQty = cart?.cart.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0
  const isPaymentAllowed = (method: string): boolean => {
    if (availablePaymentMethods.length === 0) return true
    const rule = availablePaymentMethods.find(r => r.method === method)
    if (!rule) return false
    if (rule.minQty === null) return true
    return totalCartQty >= rule.minQty
  }

  // Checkout restriction enforcement
  const hasCheckoutRestriction = checkoutRestrictions.some(cr => cr.restricted)
  const walletInsufficient = paymentMethod === "WALLET" && cart && walletCreditInfo && (cart.totals.total - couponDiscount) > walletCreditInfo.availableCredit
  const isCheckoutBlocked = hasCheckoutRestriction
    || minimumOrderQuantities.some(m => {
      const item = cart?.cart.items.find(ci => ci.product.id === m.productId)
      return item && item.quantity < m.minQty
    })
    || maximumOrderQuantities.some(m => {
      const item = cart?.cart.items.find(ci => ci.product.id === m.productId)
      return item && item.quantity > m.maxQty
    })

  // Rule discount labels
  const ruleDiscountLabels: string[] = []
  for (const d of productDiscounts) { if (d.ruleName && !ruleDiscountLabels.includes(d.ruleName)) ruleDiscountLabels.push(d.ruleName) }
  if (cartDiscount?.ruleName && !ruleDiscountLabels.includes(cartDiscount.ruleName)) ruleDiscountLabels.push(cartDiscount.ruleName)

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
  if (!cart || cart.cart.items.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <Link href="/products" className="text-primary-600 hover:underline">Continue Shopping</Link>
      </div>
    </div>
  )

  const selectedGateway = gateways.find((g) => g.provider === selectedProvider)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/cart" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to cart</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        {redirectData && (
          <form ref={formRef} method={redirectData.method} action={redirectData.url} style={{ display: "none" }}>
            {Object.entries(redirectData.params).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
          </form>
        )}

        {/* Checkout restriction warnings */}
        {hasCheckoutRestriction && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            {checkoutRestrictions.filter(cr => cr.restricted).map((cr, i) => (
              <p key={i} className="text-sm text-red-700 font-medium flex items-center gap-2">
                <AlertTriangle size={16} /> {cr.message}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="text-primary-600" size={20} />
                <h2 className="font-semibold">Shipping Address</h2>
              </div>
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="John Doe" value={address.fullName} onChange={(e) => { setAddress({ ...address, fullName: e.target.value }); if (errors.fullName) setErrors({ ...errors, fullName: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${errors.fullName ? "border-red-400" : "border-gray-200"}`} />
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                    <input type="tel" placeholder="+91 98765 43210" value={address.phone} onChange={(e) => { setAddress({ ...address, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${errors.phone ? "border-red-400" : "border-gray-200"}`} />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(optional)</span></label>
                    <input type="email" placeholder="john@example.com" value={address.email} onChange={(e) => { setAddress({ ...address, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${errors.email ? "border-red-400" : "border-gray-200"}`} />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>

                {/* Address Lines */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Street Address <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="123 Main Street" value={address.street} onChange={(e) => { setAddress({ ...address, street: e.target.value }); if (errors.street) setErrors({ ...errors, street: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${errors.street ? "border-red-400" : "border-gray-200"}`} />
                    {errors.street && <p className="text-xs text-red-500 mt-1">{errors.street}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Apartment / Suite / Unit <span className="text-gray-400">(optional)</span></label>
                      <input type="text" placeholder="Apt 4B, Building 5" value={address.apartment} onChange={(e) => setAddress({ ...address, apartment: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Landmark / Area <span className="text-gray-400">(optional)</span></label>
                      <input type="text" placeholder="Near City Mall" value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>

                {/* City / State / ZIP / Country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Mumbai" value={address.city} onChange={(e) => { setAddress({ ...address, city: e.target.value }); if (errors.city) setErrors({ ...errors, city: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${errors.city ? "border-red-400" : "border-gray-200"}`} />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                    {address.country === "India" ? (
                      <select value={address.state} onChange={(e) => { setAddress({ ...address, state: e.target.value }); if (errors.state) setErrors({ ...errors, state: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm bg-white ${errors.state ? "border-red-400" : "border-gray-200"}`}>
                        <option value="">Select State</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="State" value={address.state} onChange={(e) => { setAddress({ ...address, state: e.target.value }); if (errors.state) setErrors({ ...errors, state: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${errors.state ? "border-red-400" : "border-gray-200"}`} />
                    )}
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input type="text" placeholder="400001" maxLength={6} value={address.zip} onChange={(e) => { setAddress({ ...address, zip: e.target.value }); if (errors.zip) setErrors({ ...errors, zip: "" }) }} onBlur={(e) => { if (e.target.value.length === 6) handlePincodeLookup(e.target.value, false) }} className={`w-full px-4 py-2 border rounded-lg text-sm pr-8 ${errors.zip ? "border-red-400" : "border-gray-200"}`} />
                      {pincodeLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>}
                    </div>
                    {errors.zip && <p className="text-xs text-red-500 mt-1">{errors.zip}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
                    <select value={address.country} onChange={(e) => { setAddress({ ...address, country: e.target.value }); if (errors.country) setErrors({ ...errors, country: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm bg-white ${errors.country ? "border-red-400" : "border-gray-200"}`}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
                  </div>
                </div>
                {/* Locality dropdown — shown when PIN code lookup returns specific areas */}
                {pincodeLocations.length > 0 && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Locality / Post Office</label>
                    <select value={address.street} onChange={(e) => { setAddress({ ...address, street: e.target.value }); if (errors.street) setErrors({ ...errors, street: "" }) }} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="">Select locality</option>
                      {pincodeLocations.map((loc, i) => (
                        <option key={i} value={loc.name}>{loc.name} — {loc.district}, {loc.block}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Select your specific area, or type your street address below</p>
                  </div>
                )}
              </div>
            </div>

            {/* Billing Address */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Receipt className="text-primary-600" size={20} />
                  <h2 className="font-semibold">Billing Address</h2>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={billingSameAsShipping} onChange={(e) => setBillingSameAsShipping(e.target.checked)} className="rounded border-gray-300 accent-primary-600" />
                  Same as shipping
                </label>
              </div>
              {!billingSameAsShipping && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="John Doe" value={billingAddress.fullName} onChange={(e) => { setBillingAddress({ ...billingAddress, fullName: e.target.value }); if (billingErrors.fullName) setBillingErrors({ ...billingErrors, fullName: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${billingErrors.fullName ? "border-red-400" : "border-gray-200"}`} />
                      {billingErrors.fullName && <p className="text-xs text-red-500 mt-1">{billingErrors.fullName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                      <input type="tel" placeholder="+91 98765 43210" value={billingAddress.phone} onChange={(e) => { setBillingAddress({ ...billingAddress, phone: e.target.value }); if (billingErrors.phone) setBillingErrors({ ...billingErrors, phone: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${billingErrors.phone ? "border-red-400" : "border-gray-200"}`} />
                      {billingErrors.phone && <p className="text-xs text-red-500 mt-1">{billingErrors.phone}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(optional)</span></label>
                    <input type="email" placeholder="billing@example.com" value={billingAddress.email} onChange={(e) => { setBillingAddress({ ...billingAddress, email: e.target.value }); if (billingErrors.email) setBillingErrors({ ...billingErrors, email: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${billingErrors.email ? "border-red-400" : "border-gray-200"}`} />
                    {billingErrors.email && <p className="text-xs text-red-500 mt-1">{billingErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Street Address <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="123 Main Street" value={billingAddress.street} onChange={(e) => { setBillingAddress({ ...billingAddress, street: e.target.value }); if (billingErrors.street) setBillingErrors({ ...billingErrors, street: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${billingErrors.street ? "border-red-400" : "border-gray-200"}`} />
                    {billingErrors.street && <p className="text-xs text-red-500 mt-1">{billingErrors.street}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Apartment / Suite / Unit <span className="text-gray-400">(optional)</span></label>
                      <input type="text" placeholder="Apt 4B" value={billingAddress.apartment} onChange={(e) => setBillingAddress({ ...billingAddress, apartment: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Landmark / Area <span className="text-gray-400">(optional)</span></label>
                      <input type="text" placeholder="Near City Mall" value={billingAddress.landmark} onChange={(e) => setBillingAddress({ ...billingAddress, landmark: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="Mumbai" value={billingAddress.city} onChange={(e) => { setBillingAddress({ ...billingAddress, city: e.target.value }); if (billingErrors.city) setBillingErrors({ ...billingErrors, city: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${billingErrors.city ? "border-red-400" : "border-gray-200"}`} />
                      {billingErrors.city && <p className="text-xs text-red-500 mt-1">{billingErrors.city}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                      {billingAddress.country === "India" ? (
                        <select value={billingAddress.state} onChange={(e) => { setBillingAddress({ ...billingAddress, state: e.target.value }); if (billingErrors.state) setBillingErrors({ ...billingErrors, state: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm bg-white ${billingErrors.state ? "border-red-400" : "border-gray-200"}`}>
                          <option value="">Select State</option>
                          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input type="text" placeholder="State" value={billingAddress.state} onChange={(e) => { setBillingAddress({ ...billingAddress, state: e.target.value }); if (billingErrors.state) setBillingErrors({ ...billingErrors, state: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm ${billingErrors.state ? "border-red-400" : "border-gray-200"}`} />
                      )}
                      {billingErrors.state && <p className="text-xs text-red-500 mt-1">{billingErrors.state}</p>}
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input type="text" placeholder="400001" maxLength={6} value={billingAddress.zip} onChange={(e) => { setBillingAddress({ ...billingAddress, zip: e.target.value }); if (billingErrors.zip) setBillingErrors({ ...billingErrors, zip: "" }) }} onBlur={(e) => { if (e.target.value.length === 6) handlePincodeLookup(e.target.value, true) }} className={`w-full px-4 py-2 border rounded-lg text-sm pr-8 ${billingErrors.zip ? "border-red-400" : "border-gray-200"}`} />
                        {billingPincodeLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>}
                      </div>
                      {billingErrors.zip && <p className="text-xs text-red-500 mt-1">{billingErrors.zip}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
                      <select value={billingAddress.country} onChange={(e) => { setBillingAddress({ ...billingAddress, country: e.target.value }); if (billingErrors.country) setBillingErrors({ ...billingErrors, country: "" }) }} className={`w-full px-4 py-2 border rounded-lg text-sm bg-white ${billingErrors.country ? "border-red-400" : "border-gray-200"}`}>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {billingErrors.country && <p className="text-xs text-red-500 mt-1">{billingErrors.country}</p>}
                    </div>
                  </div>
                  {/* Locality dropdown for billing */}
                  {billingPincodeLocations.length > 0 && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Locality / Post Office</label>
                      <select value={billingAddress.street} onChange={(e) => { setBillingAddress({ ...billingAddress, street: e.target.value }); if (billingErrors.street) setBillingErrors({ ...billingErrors, street: "" }) }} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                        <option value="">Select locality</option>
                        {billingPincodeLocations.map((loc, i) => (
                          <option key={i} value={loc.name}>{loc.name} — {loc.district}, {loc.block}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Select your specific area, or type your street address below</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="text-primary-600" size={20} />
                <h2 className="font-semibold">Payment Method</h2>
              </div>
              <div className="space-y-3">
                {isPaymentAllowed("COD") && (
                  <label
                    onClick={() => setPaymentMethod("COD")}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition ${paymentMethod === "COD" ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <input type="radio" name="payment" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} className="accent-primary-600" />
                    <div className="flex items-center gap-3">
                      <Banknote size={20} className="text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Cash on Delivery (COD)</p>
                        <p className="text-xs text-gray-500">Pay when your order arrives</p>
                      </div>
                    </div>
                  </label>
                )}

                {walletCreditInfo && walletCreditInfo.availableCredit > 0 && (
                  <label
                    onClick={() => setPaymentMethod("WALLET")}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition ${paymentMethod === "WALLET" ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <input type="radio" name="payment" checked={paymentMethod === "WALLET"} onChange={() => setPaymentMethod("WALLET")} className="accent-primary-600" />
                    <div className="flex items-center gap-3">
                      <Wallet size={20} className="text-gray-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Pay from Wallet</p>
                        <p className="text-xs text-gray-500">
                          Available: {formatPrice(walletCreditInfo.availableCredit)}
                          {walletCreditInfo.outstanding > 0 && <span className="text-red-500 ml-1">| Outstanding: {formatPrice(walletCreditInfo.outstanding)}</span>}
                        </p>
                      </div>
                      {cart && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          cart.totals.total - couponDiscount <= walletCreditInfo.availableCredit
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {cart.totals.total - couponDiscount <= walletCreditInfo.availableCredit ? "Sufficient" : "Insufficient"}
                        </span>
                      )}
                    </div>
                  </label>
                )}

                {gateways.filter(gw => isPaymentAllowed(gw.provider) || isPaymentAllowed("ONLINE")).map((gw) => (
                  <label
                    key={gw.id}
                    onClick={() => { setPaymentMethod("ONLINE"); setSelectedProvider(gw.provider) }}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition ${paymentMethod === "ONLINE" && selectedProvider === gw.provider ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "ONLINE" && selectedProvider === gw.provider}
                      onChange={() => { setPaymentMethod("ONLINE"); setSelectedProvider(gw.provider) }}
                      className="accent-primary-600"
                    />
                    <div className="flex items-center gap-3">
                      <Smartphone size={20} className="text-gray-600" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{gw.label || PROVIDER_LABELS[gw.provider] || gw.provider}</p>
                          {gw.isDefault && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded">Default</span>}
                          {gw.testMode && <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-medium rounded">Test</span>}
                        </div>
                        <p className="text-xs text-gray-500">{gw.description || PROVIDER_DESCRIPTIONS[gw.provider] || "Online payment"}</p>
                      </div>
                    </div>
                  </label>
                ))}

                {!isPaymentAllowed("COD") && gateways.filter(gw => isPaymentAllowed(gw.provider) || isPaymentAllowed("ONLINE")).length === 0 && (
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-center">
                    <p className="text-sm text-gray-500">No payment methods available for your order. Please check order requirements.</p>
                  </div>
                )}
              </div>

              {/* Min/Max quantity warnings */}
              {(minimumOrderQuantities.length > 0 || maximumOrderQuantities.length > 0) && (
                <div className="mt-3 space-y-1">
                  {minimumOrderQuantities.map((m, i) => {
                    const item = cart?.cart.items.find(ci => ci.product.id === m.productId)
                    if (!item || item.quantity >= m.minQty) return null
                    return <p key={`min-${i}`} className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> Min. {m.minQty} units required for {item.product.title} ({m.ruleName})</p>
                  })}
                  {maximumOrderQuantities.map((m, i) => {
                    const item = cart?.cart.items.find(ci => ci.product.id === m.productId)
                    if (!item || item.quantity <= m.maxQty) return null
                    return <p key={`max-${i}`} className="text-xs text-red-700 flex items-center gap-1"><AlertTriangle size={12} /> Max. {m.maxQty} units allowed for {item.product.title} ({m.ruleName})</p>
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm mb-4">
                {cart.cart.items.map((item) => {
                  const disc = ruleProductDiscountMap.get(item.product.id)
                  const unitPrice = disc ? Number(item.unitPrice) - disc.discountAmount : Number(item.unitPrice)
                  return (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-600">{item.product.title} x{item.quantity}</span>
                      <span className="font-medium">{formatPrice(unitPrice * item.quantity)}</span>
                    </div>
                  )
                })}
              </div>

              {/* BOGO free items */}
              {bogo.length > 0 && (
                <div className="mb-2 space-y-1">
                  {bogo.map((b, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-pink-600 font-medium flex items-center gap-1"><Gift size={12} /> FREE x{b.freeQuantity} ({b.ruleName})</span>
                      <span className="text-pink-600 font-medium">{formatPrice(0)}</span>
                    </div>
                  ))}
                </div>
              )}

              <hr className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(totals.subtotal)}</span>
                </div>

                {ruleProductSavings > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center gap-1"><Percent size={14} className="text-green-500" /> {ruleDiscountLabels.length > 0 ? `Discount (${ruleDiscountLabels.join(", ")})` : "Rule Discount"}</span>
                    <span className="font-medium text-green-600">-{formatPrice(ruleProductSavings)}</span>
                  </div>
                )}
                {ruleCartSavings > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cart Discount</span>
                    <span className="font-medium text-green-600">-{formatPrice(ruleCartSavings)}</span>
                  </div>
                )}
                {paymentSavings > 0 && paymentMethodDiscount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{paymentMethodDiscount.ruleName}</span>
                    <span className="font-medium text-green-600">-{formatPrice(paymentSavings)}</span>
                  </div>
                )}
                {qtyDiscountSavings > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center gap-1"><Layers size={14} className="text-cyan-500" /> Bulk Discount</span>
                    <span className="font-medium text-green-600">-{formatPrice(qtyDiscountSavings)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Coupon ({couponCode.toUpperCase()})</span>
                    <span className="font-medium text-green-600">-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
                {extraCharges.length > 0 && extraCharges.map((ec, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{ec.chargeLabel}</span>
                    <span className="font-medium">{formatPrice(ec.chargeAmount)}</span>
                  </div>
                ))}
                {taxes.length > 0 ? taxes.map((tax, i) => {
                  const taxAmount = (totals.subtotal * tax.taxRate) / 100
                  return (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-600">{tax.taxLabel} ({tax.taxRate}%)</span>
                      <span className="font-medium">{formatPrice(taxAmount)}</span>
                    </div>
                  )
                }) : ruleTaxTotal === 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18% GST)</span>
                    <span className="font-medium">{formatPrice(totals.tax)}</span>
                  </div>
                )}
                {shipping ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center gap-1"><Truck size={14} /> {shipping.ruleName}</span>
                    <span className="font-medium">{shipping.cost > 0 ? formatPrice(shipping.cost) : <span className="text-green-600">Free</span>}</span>
                  </div>
                ) : totals.shipping > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">{formatPrice(totals.shipping)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <input type="text" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <button onClick={applyCoupon} disabled={!couponCode} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition disabled:opacity-50"><Tag size={16} /></button>
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}

              <hr className="my-4" />
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-xl font-bold text-primary-700">{formatPrice(finalTotal)}</span>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing || redirectData !== null || isCheckoutBlocked || !!walletInsufficient}
                className={`w-full mt-6 py-3 rounded-lg transition disabled:opacity-50 ${(isCheckoutBlocked || walletInsufficient) ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-primary-600 text-white hover:bg-primary-700"}`}
              >
                {placing ? (redirectData ? "Redirecting to payment..." : "Placing Order...") : isCheckoutBlocked ? "Checkout Restricted" : walletInsufficient ? "Insufficient Wallet Credit" : (paymentMethod === "ONLINE" ? "Pay Now" : paymentMethod === "WALLET" ? "Pay from Wallet" : "Place Order")}
              </button>
              {paymentMethod === "ONLINE" && selectedGateway && (
                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400">
                  <Shield size={12} />
                  <span>Secure checkout via {selectedGateway.label || PROVIDER_LABELS[selectedProvider] || selectedProvider}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}