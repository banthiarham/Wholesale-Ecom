"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, CreditCard, Tag, Smartphone, Banknote, Wallet, Zap, Shield, Gift, AlertTriangle, Percent, Layers, Truck, ShoppingCart, Landmark } from "lucide-react"
import { formatPrice, getCartSessionId, COUNTRIES } from "@/lib/utils"
import { INDIAN_STATES, lookupPincode } from "@/lib/indian-address"
import { useStorefrontRules } from "@/lib/rules"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { useToast } from "@/components/ui/Toast"
import { EmptyState } from "@/components/ui/EmptyState"
import { PaymentOffer, fetchPaymentOffers, checkOfferEligibility, calcOfferDiscount, calcLineTotal } from "@/lib/pricing"
import { BankOfferCard, OfferVerifyModal } from "@/components/ui/BankOffers"

interface CartItem {
  id: string; quantity: number; unitPrice: number;
  product: { id: string; title: string; handle: string; thumbnail: string | null; sku: string | null; moq: number; unitPrice: string; compareAtPrice: string | null; tierPrices: { minQty: number; maxQty: number | null; price: string }[]; category?: { id: string; name: string; handle: string } }
}

interface CartData {
  cart: { id: string; items: CartItem[] }
  totals: { subtotal: number; itemCount: number; tax: number; shipping: number; total: number }
}

interface LoyaltyData {
  points: number; walletBalance: number; tier: string
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

interface WalletCreditInfo {
  walletId: string
  balance: number
  creditLimit: number
  availableCredit: number
  outstanding: number
  limitReached: boolean
}

// Parses an API response body, surfacing a clear error instead of letting a non-JSON
// response (e.g. a proxy/server error page) blow up with an opaque "Something went wrong".
async function parseApiResponse(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Server returned an unexpected response (status ${res.status}). Please try again in a moment.`)
  }
}

/* Numbered step indicator for checkout section headers — purely visual, the
   underlying flow is still a single scrollable page, not a gated wizard. */
function StepBadge({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const roundOffEnabled = useSetting("roundOffEnabled", "false") === "true"
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
  const [walletCreditInfo, setWalletCreditInfo] = useState<WalletCreditInfo | null>(null)
  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponError, setCouponError] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD")
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [gateways, setGateways] = useState<EnabledGateway[]>([])
  const [redirectData, setRedirectData] = useState<{ url: string; method: string; params: Record<string, string> } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null)
  const [useWallet, setUseWallet] = useState(false)
  const [walletAmount, setWalletAmount] = useState(0)
  const [usePoints, setUsePoints] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  const [pointsRedeeming, setPointsRedeeming] = useState(false)
  const [bankOffers, setBankOffers] = useState<PaymentOffer[]>([])
  const [selectedBankOfferId, setSelectedBankOfferId] = useState<string | null>(null)
  const [verifyingOfferId, setVerifyingOfferId] = useState<string | null>(null)
  const { showToast } = useToast()

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
    shippingRegion: address.state || undefined,
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
    if (token) {
      fetch("/api/loyalty/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => { if (data.points !== undefined) setLoyalty(data) })
        .catch((err) => { console.error("Failed to fetch loyalty data:", err) })
    }
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
      .catch((err) => { console.error("Failed to fetch payment gateways:", err) })
    // Load wallet credit info if logged in
    if (token) {
      fetch("/api/wallets/me/credit-info", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.creditInfo) setWalletCreditInfo(data.creditInfo) })
        .catch(() => {})
    }
    // All currently active bank/UPI offers — filtered against the cart client-side below.
    fetchPaymentOffers().then(setBankOffers)
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
        handler: async function (response: any) {
          const token = localStorage.getItem("token")
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })
            if (verifyRes.ok) {
              router.push(`/orders/${data.orderId}?payment=success`)
            } else {
              router.push(`/orders/${data.orderId}?payment=failure`)
            }
          } catch (err) {
            // Payment likely succeeded at the gateway but our verification call couldn't be reached
            // (network error) — send the customer to the order page rather than losing the outcome.
            router.push(`/orders/${data.orderId}?payment=error`)
          } finally {
            setPlacing(false)
          }
        },
        modal: {
          // Customer closed the popup without paying (Payment Cancelled) — let them retry.
          ondismiss: function () { setPlacing(false) },
        },
      }
      const rzp = new (window as any).Razorpay(options)
      rzp.on("payment.failed", function () {
        showToast("error", "Payment failed. This can happen due to insufficient funds, a bank decline, or a network issue. You can retry the payment or choose another method.")
        setPlacing(false)
      })
      rzp.open()
    }
    script.onerror = () => {
      showToast("error", "Could not load the Razorpay checkout. Please check your internet connection and try again.")
      setPlacing(false)
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

  const walletInsufficient = paymentMethod === "WALLET" && cart && walletCreditInfo && (cart.totals.total - couponDiscount) > walletCreditInfo.availableCredit

  const placeOrder = async () => {
    if (!cart || placing) return
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
          bankOfferId: selectedBankOfferEntry?.eligible ? selectedBankOfferId : undefined,
        }),
      })
      const data = await parseApiResponse(res)
      if (!res.ok) {
        console.error("Order creation failed:", res.status, data)
        showToast("error", data.message || `Failed to place order (status ${res.status})`)
        setPlacing(false)
        return
      }

      const orderId = data.order.id

      if (paymentMethod === "WALLET") {
        // Pay from wallet — debit the wallet and record payment
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
          const walletErr = await parseApiResponse(walletRes)
          console.error("Wallet payment failed:", walletRes.status, walletErr)
          showToast("error", walletErr.message || `Wallet payment failed (status ${walletRes.status}). Please try another payment method.`)
          setPlacing(false)
          return
        }
        // Record wallet payment
        await fetch(`/api/payments/initiate/${orderId}?provider=WALLET&returnUrl=${encodeURIComponent(`${window.location.origin}/orders/${orderId}`)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
        showToast("success", "Order placed and paid from wallet!")
        router.push(`/orders/${orderId}`)
        return
      }

      if (paymentMethod === "COD") {
        showToast("success", "Order placed successfully!")
        router.push(`/orders/${orderId}`)
        return
      }

      const returnUrl = `${window.location.origin}/orders/${orderId}`
      const initRes = await fetch(
        `/api/payments/initiate/${orderId}?provider=${selectedProvider}&returnUrl=${encodeURIComponent(returnUrl)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      )
      const initData = await parseApiResponse(initRes)

      if (!initRes.ok) {
        console.error("Payment initiation failed:", initRes.status, initData)
        showToast("error", initData.message || `Failed to initiate payment (status ${initRes.status}). Please try COD or contact support.`)
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

      showToast("error", "Payment initiated but no redirect was received. Please check your order status.")
      router.push(`/orders/${orderId}`)
    } catch (err) {
      console.error("Checkout failed:", err)
      const message = err instanceof Error && err.message ? err.message : "Something went wrong while placing your order. Please try again."
      showToast("error", message)
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
  // Falls back to the backend's rule-engine-computed totals.tax when the client-side rules
  // hook has no taxes yet, matching the Tax row's own fallback below — keeps this total in
  // sync with the cart page's total instead of silently dropping tax.
  const effectiveTax = taxes.length > 0 ? ruleTaxTotal : totals.tax
  const effectiveShipping = shipping ? shipping.cost : totals.shipping
  const walletDeduction = useWallet ? Math.min(walletAmount, Number(loyalty?.walletBalance || 0), totals.total - couponDiscount) : 0
  const pointsValue = usePoints ? pointsToRedeem : 0

  // Bank/UPI offers — eligibility mirrors the server's re-validation basis (subtotal
  // after coupon) so the amount shown here matches what actually gets charged.
  const cartItemsForOffers = (cart?.cart.items ?? []).map((item) => ({ productId: item.product.id, categoryId: item.product.category?.id }))
  const bankOfferBasis = Math.max(0, totals.subtotal - couponDiscount)
  const bankOffersOnlinePaymentRequired = paymentMethod !== "ONLINE"
  const evaluatedBankOffers = bankOffers.map((offer) => {
    const eligibility = checkOfferEligibility(offer, cartItemsForOffers, bankOfferBasis)
    const reason = bankOffersOnlinePaymentRequired
      ? "Select Credit/Debit Card, UPI, or Net Banking payment to use this offer"
      : eligibility.reason
    return { offer, eligible: eligibility.eligible && !bankOffersOnlinePaymentRequired, reason }
  })
  const selectedBankOfferEntry = evaluatedBankOffers.find((e) => e.offer.id === selectedBankOfferId)
  const bankOfferDiscount = selectedBankOfferEntry?.eligible ? calcOfferDiscount(selectedBankOfferEntry.offer, bankOfferBasis) : 0

  // Clear the selection if it's no longer eligible (e.g. switching away from an online payment method).
  useEffect(() => {
    if (selectedBankOfferId && !selectedBankOfferEntry?.eligible) setSelectedBankOfferId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod])

  const preRoundTotal = Math.max(0, totals.subtotal - ruleProductSavings - ruleCartSavings - paymentSavings - qtyDiscountSavings - couponDiscount - bankOfferDiscount - walletDeduction - pointsValue + extraChargesTotal + effectiveTax + effectiveShipping)
  const roundOffAmount = roundOffEnabled ? Math.round(preRoundTotal) - preRoundTotal : 0
  const finalTotal = preRoundTotal + roundOffAmount

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
  const isCheckoutBlocked = hasCheckoutRestriction
    || walletInsufficient
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

  const handleRedeemPoints = async () => {
    if (!pointsToRedeem || pointsToRedeem <= 0) return
    const token = localStorage.getItem("token")
    if (!token) return
    setPointsRedeeming(true)
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ points: pointsToRedeem, description: "Redeemed at checkout" }),
      })
      if (res.ok) {
        const data = await res.json()
        setLoyalty((prev) => prev ? { ...prev, points: data.points ?? prev.points - pointsToRedeem, walletBalance: data.walletBalance ?? prev.walletBalance } : prev)
        setUseWallet(true)
        setWalletAmount((prev) => prev + pointsToRedeem)
      } else { showToast("error", "Failed to redeem points") }
    } catch { showToast("error", "Failed to redeem points") } finally { setPointsRedeeming(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
      </main>
    </div>
  )
  if (!cart || cart.cart.items.length === 0) return (
    <div className="min-h-screen bg-gray-50">
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        description="Add some products to your cart before checking out."
        action={{ label: "Continue Shopping", href: "/products" }}
      />
    </div>
  )

  const selectedGateway = gateways.find((g) => g.provider === selectedProvider)

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <Link href="/cart" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 mb-6 transition-colors"><ArrowLeft size={16} /> Back to cart</Link>
        <h1 className="heading-lg mb-6">Checkout</h1>

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
            <div className="card-base-static p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <StepBadge n={1} />
                <MapPin className="text-primary-600" size={19} />
                <h2 className="font-bold text-gray-900">Shipping Address</h2>
              </div>
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="John Doe" value={address.fullName} onChange={(e) => { setAddress({ ...address, fullName: e.target.value }); if (errors.fullName) setErrors({ ...errors, fullName: "" }) }} className={`input-base ${errors.fullName ? "!border-red-400" : ""}`} />
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                    <input type="tel" placeholder="+91 98765 43210" value={address.phone} onChange={(e) => { setAddress({ ...address, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: "" }) }} className={`input-base ${errors.phone ? "!border-red-400" : ""}`} />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(optional)</span></label>
                  <input type="email" placeholder="john@example.com" value={address.email} onChange={(e) => { setAddress({ ...address, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: "" }) }} className={`input-base ${errors.email ? "!border-red-400" : ""}`} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                {/* Address Lines */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Street Address <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="123 Main Street" value={address.street} onChange={(e) => { setAddress({ ...address, street: e.target.value }); if (errors.street) setErrors({ ...errors, street: "" }) }} className={`input-base ${errors.street ? "!border-red-400" : ""}`} />
                  {errors.street && <p className="text-xs text-red-500 mt-1">{errors.street}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Apartment / Suite <span className="text-gray-400">(optional)</span></label>
                    <input type="text" placeholder="Apt 4B" value={address.apartment} onChange={(e) => setAddress({ ...address, apartment: e.target.value })} className="input-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Landmark / Area <span className="text-gray-400">(optional)</span></label>
                    <input type="text" placeholder="Near City Mall" value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} className="input-base" />
                  </div>
                </div>

                {/* City / State / PIN / Country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Mumbai" value={address.city} onChange={(e) => { setAddress({ ...address, city: e.target.value }); if (errors.city) setErrors({ ...errors, city: "" }) }} className={`input-base ${errors.city ? "!border-red-400" : ""}`} />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                    {address.country === "India" ? (
                      <select value={address.state} onChange={(e) => { setAddress({ ...address, state: e.target.value }); if (errors.state) setErrors({ ...errors, state: "" }) }} className={`input-base ${errors.state ? "!border-red-400" : ""}`}>
                        <option value="">Select State</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="State" value={address.state} onChange={(e) => { setAddress({ ...address, state: e.target.value }); if (errors.state) setErrors({ ...errors, state: "" }) }} className={`input-base ${errors.state ? "!border-red-400" : ""}`} />
                    )}
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input type="text" placeholder="400001" maxLength={6} value={address.zip} onChange={(e) => { setAddress({ ...address, zip: e.target.value }); if (errors.zip) setErrors({ ...errors, zip: "" }) }} onBlur={(e) => { if (e.target.value.length === 6) handlePincodeLookup(e.target.value, false) }} className={`input-base pr-8 ${errors.zip ? "!border-red-400" : ""}`} />
                      {pincodeLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>}
                    </div>
                    {errors.zip && <p className="text-xs text-red-500 mt-1">{errors.zip}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
                    <select value={address.country} onChange={(e) => { setAddress({ ...address, country: e.target.value }); if (errors.country) setErrors({ ...errors, country: "" }) }} className={`input-base ${errors.country ? "!border-red-400" : ""}`}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
                  </div>
                </div>
                {/* Locality dropdown from PIN code */}
                {pincodeLocations.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Locality / Post Office</label>
                    <select value={address.street} onChange={(e) => { setAddress({ ...address, street: e.target.value }); if (errors.street) setErrors({ ...errors, street: "" }) }} className="input-base">
                      <option value="">Select locality</option>
                      {pincodeLocations.map((loc, i) => (
                        <option key={i} value={loc.name}>{loc.name} — {loc.district}, {loc.block}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Select your specific area, or type your street address in the Street field above</p>
                  </div>
                )}
              </div>
            </div>

            {/* Billing Address */}
            <div className="card-base-static p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="text-primary-600" size={19} />
                  <h2 className="font-bold text-gray-900">Billing Address</h2>
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
                      <input type="text" placeholder="John Doe" value={billingAddress.fullName} onChange={(e) => { setBillingAddress({ ...billingAddress, fullName: e.target.value }); if (billingErrors.fullName) setBillingErrors({ ...billingErrors, fullName: "" }) }} className={`input-base ${billingErrors.fullName ? "!border-red-400" : ""}`} />
                      {billingErrors.fullName && <p className="text-xs text-red-500 mt-1">{billingErrors.fullName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                      <input type="tel" placeholder="+91 98765 43210" value={billingAddress.phone} onChange={(e) => { setBillingAddress({ ...billingAddress, phone: e.target.value }); if (billingErrors.phone) setBillingErrors({ ...billingErrors, phone: "" }) }} className={`input-base ${billingErrors.phone ? "!border-red-400" : ""}`} />
                      {billingErrors.phone && <p className="text-xs text-red-500 mt-1">{billingErrors.phone}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(optional)</span></label>
                    <input type="email" placeholder="billing@example.com" value={billingAddress.email} onChange={(e) => { setBillingAddress({ ...billingAddress, email: e.target.value }); if (billingErrors.email) setBillingErrors({ ...billingErrors, email: "" }) }} className={`input-base ${billingErrors.email ? "!border-red-400" : ""}`} />
                    {billingErrors.email && <p className="text-xs text-red-500 mt-1">{billingErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Street Address <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="123 Main Street" value={billingAddress.street} onChange={(e) => { setBillingAddress({ ...billingAddress, street: e.target.value }); if (billingErrors.street) setBillingErrors({ ...billingErrors, street: "" }) }} className={`input-base ${billingErrors.street ? "!border-red-400" : ""}`} />
                    {billingErrors.street && <p className="text-xs text-red-500 mt-1">{billingErrors.street}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Apartment / Suite <span className="text-gray-400">(optional)</span></label>
                      <input type="text" placeholder="Apt 4B" value={billingAddress.apartment} onChange={(e) => setBillingAddress({ ...billingAddress, apartment: e.target.value })} className="input-base" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Landmark / Area <span className="text-gray-400">(optional)</span></label>
                      <input type="text" placeholder="Near City Mall" value={billingAddress.landmark} onChange={(e) => setBillingAddress({ ...billingAddress, landmark: e.target.value })} className="input-base" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="Mumbai" value={billingAddress.city} onChange={(e) => { setBillingAddress({ ...billingAddress, city: e.target.value }); if (billingErrors.city) setBillingErrors({ ...billingErrors, city: "" }) }} className={`input-base ${billingErrors.city ? "!border-red-400" : ""}`} />
                      {billingErrors.city && <p className="text-xs text-red-500 mt-1">{billingErrors.city}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                      {billingAddress.country === "India" ? (
                        <select value={billingAddress.state} onChange={(e) => { setBillingAddress({ ...billingAddress, state: e.target.value }); if (billingErrors.state) setBillingErrors({ ...billingErrors, state: "" }) }} className={`input-base ${billingErrors.state ? "!border-red-400" : ""}`}>
                          <option value="">Select State</option>
                          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input type="text" placeholder="State" value={billingAddress.state} onChange={(e) => { setBillingAddress({ ...billingAddress, state: e.target.value }); if (billingErrors.state) setBillingErrors({ ...billingErrors, state: "" }) }} className={`input-base ${billingErrors.state ? "!border-red-400" : ""}`} />
                      )}
                      {billingErrors.state && <p className="text-xs text-red-500 mt-1">{billingErrors.state}</p>}
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input type="text" placeholder="400001" maxLength={6} value={billingAddress.zip} onChange={(e) => { setBillingAddress({ ...billingAddress, zip: e.target.value }); if (billingErrors.zip) setBillingErrors({ ...billingErrors, zip: "" }) }} onBlur={(e) => { if (e.target.value.length === 6) handlePincodeLookup(e.target.value, true) }} className={`input-base pr-8 ${billingErrors.zip ? "!border-red-400" : ""}`} />
                        {billingPincodeLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>}
                      </div>
                      {billingErrors.zip && <p className="text-xs text-red-500 mt-1">{billingErrors.zip}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
                      <select value={billingAddress.country} onChange={(e) => { setBillingAddress({ ...billingAddress, country: e.target.value }); if (billingErrors.country) setBillingErrors({ ...billingErrors, country: "" }) }} className={`input-base ${billingErrors.country ? "!border-red-400" : ""}`}>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {billingErrors.country && <p className="text-xs text-red-500 mt-1">{billingErrors.country}</p>}
                    </div>
                  </div>
                  {billingPincodeLocations.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Locality / Post Office</label>
                      <select value={billingAddress.street} onChange={(e) => { setBillingAddress({ ...billingAddress, street: e.target.value }); if (billingErrors.street) setBillingErrors({ ...billingErrors, street: "" }) }} className="input-base">
                        <option value="">Select locality</option>
                        {billingPincodeLocations.map((loc, i) => (
                          <option key={i} value={loc.name}>{loc.name} — {loc.district}, {loc.block}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Select your specific area, or type your street address in the Street field above</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card-base-static p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <StepBadge n={2} />
                <CreditCard className="text-primary-600" size={19} />
                <h2 className="font-bold text-gray-900">Payment Method</h2>
              </div>
              <div className="space-y-3">
                {isPaymentAllowed("COD") && (
                  <label
                    onClick={() => setPaymentMethod("COD")}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === "COD" ? "border-primary-600 bg-primary-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}
                  >
                    <input type="radio" name="payment" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} className="accent-primary-600 w-4 h-4" />
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "COD" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        <Banknote size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Cash on Delivery (COD)</p>
                        <p className="text-xs text-gray-500">Pay when your order arrives</p>
                      </div>
                    </div>
                  </label>
                )}

                {walletCreditInfo && (
                  <label
                    onClick={() => setPaymentMethod("WALLET")}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === "WALLET" ? "border-primary-600 bg-primary-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}
                  >
                    <input type="radio" name="payment" checked={paymentMethod === "WALLET"} onChange={() => setPaymentMethod("WALLET")} className="accent-primary-600 w-4 h-4" />
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "WALLET" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        <Wallet size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Pay from Wallet</p>
                        <p className="text-xs text-gray-500">Available credit: {formatPrice(walletCreditInfo.availableCredit)}</p>
                        {walletCreditInfo.outstanding > 0 && (
                          <p className="text-xs text-amber-600">Outstanding: {formatPrice(walletCreditInfo.outstanding)}</p>
                        )}
                        {walletInsufficient && (
                          <p className="text-xs text-red-600">Insufficient wallet credit for this order</p>
                        )}
                      </div>
                    </div>
                  </label>
                )}

                {gateways.filter(gw => isPaymentAllowed(gw.provider) || isPaymentAllowed("ONLINE")).map((gw) => (
                  <label
                    key={gw.id}
                    onClick={() => { setPaymentMethod("ONLINE"); setSelectedProvider(gw.provider) }}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === "ONLINE" && selectedProvider === gw.provider ? "border-primary-600 bg-primary-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "ONLINE" && selectedProvider === gw.provider}
                      onChange={() => { setPaymentMethod("ONLINE"); setSelectedProvider(gw.provider) }}
                      className="accent-primary-600 w-4 h-4"
                    />
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "ONLINE" && selectedProvider === gw.provider ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        <Smartphone size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{gw.label || PROVIDER_LABELS[gw.provider] || gw.provider}</p>
                          {gw.isDefault && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wide">Default</span>}
                          {gw.testMode && <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-bold rounded-md uppercase tracking-wide">Test</span>}
                        </div>
                        <p className="text-xs text-gray-500">{gw.description || PROVIDER_DESCRIPTIONS[gw.provider] || "Online payment"}</p>
                      </div>
                    </div>
                  </label>
                ))}

                {!isPaymentAllowed("COD") && gateways.filter(gw => isPaymentAllowed(gw.provider) || isPaymentAllowed("ONLINE")).length === 0 && (
                  <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 text-center">
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

            {/* Bank & UPI Offers */}
            {bankOffers.length > 0 && (
              <div className="card-base-static p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <StepBadge n={3} />
                  <Landmark className="text-primary-600" size={19} />
                  <h2 className="font-bold text-gray-900">Bank &amp; UPI Offers <span className="text-gray-400 font-normal">(optional)</span></h2>
                </div>
                <div className="space-y-2.5">
                  {evaluatedBankOffers.map(({ offer, eligible, reason }) => (
                    <BankOfferCard
                      key={offer.id}
                      offer={offer}
                      selectable
                      selected={selectedBankOfferId === offer.id}
                      onApply={() => setVerifyingOfferId(offer.id)}
                      onRemove={() => setSelectedBankOfferId(null)}
                      ineligibleReason={eligible ? undefined : reason}
                    />
                  ))}
                </div>
              </div>
            )}

            {verifyingOfferId && (() => {
              const entry = evaluatedBankOffers.find((e) => e.offer.id === verifyingOfferId)
              if (!entry) return null
              return (
                <OfferVerifyModal
                  offer={entry.offer}
                  discountAmount={calcOfferDiscount(entry.offer, bankOfferBasis)}
                  onClose={() => setVerifyingOfferId(null)}
                  onApplied={() => {
                    setSelectedBankOfferId(verifyingOfferId)
                    setVerifyingOfferId(null)
                  }}
                />
              )
            })()}
          </div>

          <div className="lg:col-span-1 sticky-rail">
            <div className="card-base-static p-6">
              <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm mb-4">
                {cart.cart.items.map((item) => {
                  const disc = ruleProductDiscountMap.get(item.product.id)
                  const unitPrice = disc ? Number(item.unitPrice) - disc.discountAmount : Number(item.unitPrice)
                  return (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-600">{item.product.title} x{item.quantity}</span>
                      <span className="font-medium">{formatPrice(calcLineTotal(unitPrice, item.quantity))}</span>
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
                {bankOfferDiscount > 0 && selectedBankOfferEntry && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center gap-1"><Landmark size={14} className="text-primary-500" /> Bank Offer Discount</span>
                    <span className="font-medium text-green-600">-{formatPrice(bankOfferDiscount)}</span>
                  </div>
                )}
                {walletDeduction > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Wallet Credit</span>
                    <span className="font-medium text-green-600">-{formatPrice(walletDeduction)}</span>
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
                {roundOffAmount !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Round off</span>
                    <span className="font-medium">{roundOffAmount > 0 ? "+" : "-"}{formatPrice(Math.abs(roundOffAmount))}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <input type="text" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="input-base flex-1" />
                <button onClick={applyCoupon} disabled={!couponCode} className="px-4 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 font-medium shrink-0"><Tag size={16} /></button>
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}

              {loyalty && (Number(loyalty.walletBalance) > 0 || loyalty.points > 0) && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  {Number(loyalty.walletBalance) > 0 && (
                    <label className="flex items-center gap-3 p-3 bg-green-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={useWallet} onChange={(e) => { setUseWallet(e.target.checked); if (e.target.checked) setWalletAmount(Number(loyalty.walletBalance)) }} className="rounded border-gray-300 accent-green-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Wallet size={14} className="text-green-600" />
                          <span className="text-sm font-medium text-green-800">Use wallet balance</span>
                        </div>
                        <p className="text-xs text-green-600">Available: ₹{Number(loyalty.walletBalance).toFixed(2)}</p>
                      </div>
                      {useWallet && (
                        <input type="number" min={0} max={Number(loyalty.walletBalance)} value={walletAmount} onChange={(e) => setWalletAmount(Number(e.target.value))} className="w-24 px-2 py-1 border border-green-200 rounded text-sm text-right" />
                      )}
                    </label>
                  )}
                  {loyalty.points > 0 && !usePoints && (
                    <div className="p-3 bg-primary-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2"><Zap size={14} className="text-primary-600" /><span className="text-sm font-medium text-primary-800">Redeem points for credit</span></div>
                      <p className="text-xs text-primary-600 mb-2">{loyalty.points} points available (1 point = ₹1)</p>
                      <div className="flex gap-2">
                        <input type="number" min={1} max={loyalty.points} placeholder="Points to redeem" value={pointsToRedeem || ""} onChange={(e) => setPointsToRedeem(Number(e.target.value))} className="flex-1 px-2 py-1 border border-primary-200 rounded text-sm" />
                        <button onClick={handleRedeemPoints} disabled={pointsRedeeming || pointsToRedeem <= 0} className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50">{pointsRedeeming ? "..." : "Redeem"}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-gray-100 my-5" />
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-primary-700">{formatPrice(finalTotal)}</span>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing || redirectData !== null || isCheckoutBlocked}
                className={`w-full mt-5 ${
                  isCheckoutBlocked
                    ? "py-3.5 rounded-xl font-semibold bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "btn-primary justify-center text-base py-3.5"
                } disabled:opacity-50 transition-all duration-200`}
              >
                {placing ? (redirectData ? "Redirecting to payment..." : "Placing Order...") : walletInsufficient ? "Insufficient Wallet Credit" : isCheckoutBlocked ? "Checkout Restricted" : (paymentMethod === "ONLINE" ? "Pay Now" : paymentMethod === "WALLET" ? "Pay from Wallet" : "Place Order")}
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