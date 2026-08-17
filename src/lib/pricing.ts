"use client"

export interface TierPrice {
  id?: string
  minQty: number
  maxQty: number | null
  price: number | string
}

function toNumber(value: number | string | null | undefined): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

export function sortTierPrices(tierPrices: TierPrice[]): TierPrice[] {
  return [...tierPrices].sort((a, b) => a.minQty - b.minQty)
}

// Single source of truth for "which slab applies at this quantity" — used by the
// Product page, Mini Cart, Cart, and Checkout so they can never disagree.
export function findApplicableTier(tierPrices: TierPrice[], qty: number): TierPrice | null {
  if (!tierPrices || tierPrices.length === 0) return null
  const sorted = sortTierPrices(tierPrices)
  // Several open-ended tiers can be eligible at once (for example role tiers at
  // 1+, 10+, and 50+). The most specific applicable slab is the one with the
  // highest minimum quantity, matching the server-side pricing engine.
  return [...sorted]
    .reverse()
    .find((tp) => qty >= tp.minQty && (tp.maxQty == null || qty <= tp.maxQty)) || null
}

export function findNextTier(tierPrices: TierPrice[], qty: number): TierPrice | null {
  if (!tierPrices || tierPrices.length === 0) return null
  const sorted = sortTierPrices(tierPrices)
  return sorted.find((tp) => tp.minQty > qty) || null
}

export function getEffectiveUnitPrice(tierPrices: TierPrice[], qty: number, basePrice: number): number {
  const tier = findApplicableTier(tierPrices, qty)
  return tier ? toNumber(tier.price) : basePrice
}

export function calcLineTotal(unitPrice: number, qty: number): number {
  return unitPrice * qty
}

export function clampQuantity(qty: number, moq: number, maxQty: number): number {
  if (!Number.isFinite(qty)) return moq
  return Math.max(moq, Math.min(maxQty, Math.round(qty)))
}

// Step is always exactly 1 — never the MOQ — so +/- can never jump or double.
export function incrementQuantity(qty: number, moq: number, maxQty: number): number {
  return clampQuantity(qty + 1, moq, maxQty)
}

export function decrementQuantity(qty: number, moq: number, maxQty: number): number {
  return clampQuantity(qty - 1, moq, maxQty)
}

export interface PricingBreakdown {
  basePrice: number
  tierPrice: number
  rolePrice: number | null
  appliedRoleName: string | null
  /** The logged-in buyer's role's own quantity tiers for this product (Admin -> Role-Based
   *  Pricing), if any — e.g. [{minQty:1,price:100},{minQty:10,price:90}]. Empty when the
   *  buyer isn't logged in or their role has no tiers configured for this product. */
  roleTiers?: { minQty: number; price: number }[]
  contractPrice: number | null
  seasonalDiscount: number
  finalPrice: number
  discountAmount: number
  discountPercent: number
  appliedDiscounts: string[]
  appliedRule?: "contract" | "role" | "tier" | "discount" | "base"
}

export interface SeasonalDiscount {
  id: string
  name: string
  type: string
  value: number
  minQty: number | null
  startDate: string
  endDate: string
  productId: string | null
  categoryId: string | null
  product?: { id: string; title: string }
  category?: { id: string; name: string }
}

export interface PaymentOffer {
  id: string
  name: string
  offerType: "BANK" | "UPI"
  type: string           // PERCENTAGE | FLAT
  value: number
  maxDiscount: number | null
  minOrderValue: number | null
  bankName: string | null
  upiApp: string | null
  cardType: string | null // CREDIT | DEBIT | BOTH
  startDate: string
  endDate: string
  productId: string | null
  categoryId: string | null
  description: string | null
  product?: { id: string; title: string }
  category?: { id: string; name: string }
}

export async function fetchPricing(
  productId: string,
  quantity: number = 1,
  userId?: string
): Promise<PricingBreakdown | null> {
  try {
    const params = new URLSearchParams({ productId, quantity: String(quantity) })
    if (userId) params.set("userId", userId)
    const res = await fetch(`/api/pricing/calculate?${params.toString()}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.pricing || data
  } catch {
    return null
  }
}

export async function fetchSeasonalDiscounts(): Promise<SeasonalDiscount[]> {
  try {
    const res = await fetch("/api/pricing/seasonal-discounts")
    if (!res.ok) return []
    const data = await res.json()
    const list = Array.isArray(data) ? data : data.discounts || []
    const now = new Date()
    return list.filter((d: SeasonalDiscount) => {
      const start = new Date(d.startDate)
      const end = new Date(d.endDate)
      return start <= now && end >= now
    })
  } catch {
    return []
  }
}

export async function fetchPaymentOffers(
  productId?: string,
  categoryId?: string
): Promise<PaymentOffer[]> {
  try {
    const params = new URLSearchParams()
    if (productId) params.set("productId", productId)
    if (categoryId) params.set("categoryId", categoryId)
    const res = await fetch(`/api/pricing/payment-offers/applicable?${params.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    const list = data.offers || []
    const now = new Date()
    return list.filter((o: PaymentOffer) => {
      const start = new Date(o.startDate)
      const end = new Date(o.endDate)
      return start <= now && end >= now
    })
  } catch {
    return []
  }
}

export function getProductDiscount(discounts: SeasonalDiscount[], productId: string, categoryId?: string): SeasonalDiscount | undefined {
  if (!discounts.length) return undefined
  const productMatch = discounts.find((d) => d.productId === productId)
  if (productMatch) return productMatch
  if (categoryId) {
    const categoryMatch = discounts.find((d) => d.categoryId === categoryId)
    if (categoryMatch) return categoryMatch
  }
  const globalMatch = discounts.find((d) => !d.productId && !d.categoryId)
  return globalMatch || undefined
}

export function discountBadge(discount: SeasonalDiscount): string {
  if (discount.type === "PERCENTAGE") return `${discount.value}% OFF`
  return formatDiscountPrice(discount.value) + " OFF"
}

export function getPaymentOfferBadge(offer: PaymentOffer): string {
  if (offer.type === "PERCENTAGE") return `${offer.value}% OFF`
  return formatDiscountPrice(offer.value) + " OFF"
}

export function getPaymentOfferLabel(offer: PaymentOffer): string {
  const badge = getPaymentOfferBadge(offer)
  const source = offer.offerType === "BANK"
    ? offer.bankName || "Bank"
    : formatUpiApp(offer.upiApp)
  const cardSuffix = offer.offerType === "BANK" && offer.cardType && offer.cardType !== "BOTH"
    ? ` ${offer.cardType.toLowerCase()} card`
    : ""
  return `${badge} on ${source}${cardSuffix}`
}

export function formatUpiApp(app: string | null): string {
  const labels: Record<string, string> = {
    GOOGLE_PAY: "Google Pay",
    PHONEPE: "PhonePe",
    PAYTM: "Paytm",
    BHIM: "BHIM UPI",
    AMAZON_PAY: "Amazon Pay",
    FREECHARGE: "Freecharge",
    MOBIKWIK: "Mobikwik",
  }
  return labels[app || ""] || app || "UPI"
}

function formatDiscountPrice(val: number): string {
  return "₹" + val.toLocaleString("en-IN")
}

export interface CartItemForOffers {
  productId: string
  categoryId?: string | null
}

// Client-side mirror of the eligibility check used for display only — the server
// re-validates authoritatively when the order is actually placed (see orders.service.ts).
export function checkOfferEligibility(
  offer: PaymentOffer,
  cartItems: CartItemForOffers[],
  cartSubtotal: number
): { eligible: boolean; reason?: string } {
  const productIds = new Set(cartItems.map((i) => i.productId))
  const categoryIds = new Set(cartItems.map((i) => i.categoryId).filter(Boolean))

  if (offer.productId && !productIds.has(offer.productId)) {
    return { eligible: false, reason: "Not applicable to the items in your cart" }
  }
  if (offer.categoryId && !categoryIds.has(offer.categoryId)) {
    return { eligible: false, reason: "Not applicable to the items in your cart" }
  }
  if (offer.minOrderValue && cartSubtotal < Number(offer.minOrderValue)) {
    return { eligible: false, reason: `Minimum order value ${formatDiscountPrice(Number(offer.minOrderValue))} required` }
  }
  return { eligible: true }
}

export function calcOfferDiscount(offer: PaymentOffer, amount: number): number {
  let discount = offer.type === "PERCENTAGE" ? (amount * offer.value) / 100 : offer.value
  if (offer.maxDiscount) discount = Math.min(discount, Number(offer.maxDiscount))
  return Math.min(discount, amount)
}
