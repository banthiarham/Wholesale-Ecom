"use client"

export interface PricingBreakdown {
  basePrice: number
  tierPrice: number
  rolePrice: number | null
  appliedRoleName: string | null
  contractPrice: number | null
  seasonalDiscount: number
  finalPrice: number
  discountAmount: number
  discountPercent: number
  appliedDiscounts: string[]
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

export function getProductDiscount(discounts: SeasonalDiscount[], productId: string, categoryId?: string): SeasonalDiscount | null {
  if (!discounts.length) return null
  const productMatch = discounts.find((d) => d.productId === productId)
  if (productMatch) return productMatch
  if (categoryId) {
    const categoryMatch = discounts.find((d) => d.categoryId === categoryId)
    if (categoryMatch) return categoryMatch
  }
  const globalMatch = discounts.find((d) => !d.productId && !d.categoryId)
  return globalMatch || null
}

export function discountBadge(discount: SeasonalDiscount): string {
  if (discount.type === "PERCENTAGE") return `${discount.value}% OFF`
  return formatDiscountPrice(discount.value) + " OFF"
}

function formatDiscountPrice(val: number): string {
  return "₹" + val.toLocaleString("en-IN")
}