import { formatPrice } from "@/lib/utils"

export interface RolePricingInfo {
  rolePrice: number
  savingsPercent?: number
  appliedRoleName?: string | null
}

export interface RuleDiscountInfo {
  discountPercent: number
  discountAmount: number
  ruleName: string
}

interface ProductPriceDisplayProps {
  isPriceHidden?: boolean
  rolePricing?: RolePricingInfo | null
  ruleDiscount?: RuleDiscountInfo | null
  unitPrice: number | string
  compareAtPrice?: number | string | null
  tierPrices?: { minQty: number; maxQty: number | null; price: number | string }[]
  size?: "sm" | "md"
}

export function ProductPriceDisplay({
  isPriceHidden,
  rolePricing,
  ruleDiscount,
  unitPrice,
  compareAtPrice,
  tierPrices,
  size = "md",
}: ProductPriceDisplayProps) {
  const priceClass = size === "sm" ? "text-base font-bold" : "text-lg font-bold"
  const comparePrice = !!(compareAtPrice && Number(compareAtPrice) > Number(unitPrice))

  if (isPriceHidden) {
    return <span className="text-xs text-gray-500 italic">Login for pricing</span>
  }

  if (rolePricing) {
    return (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={`${priceClass} text-primary-700`}>{formatPrice(rolePricing.rolePrice)}</span>
        <span className="text-xs text-gray-400 line-through">{formatPrice(unitPrice)}</span>
        {rolePricing.savingsPercent !== undefined && (
          <span className="badge badge-success">{rolePricing.savingsPercent}% off</span>
        )}
      </div>
    )
  }

  if (ruleDiscount) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className={`${priceClass} text-primary-700`}>{formatPrice(Number(unitPrice) - ruleDiscount.discountAmount)}</span>
        <span className="text-xs text-gray-400 line-through">{formatPrice(unitPrice)}</span>
      </div>
    )
  }

  if (tierPrices && tierPrices.length > 0) {
    return (
      <div className="flex items-baseline gap-1">
        <span className="text-xs text-green-600 font-semibold">From</span>
        <span className={`${priceClass} text-gray-900`}>{formatPrice(Number(tierPrices[tierPrices.length - 1].price))}</span>
        {comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(Number(compareAtPrice))}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`${priceClass} text-gray-900`}>{formatPrice(unitPrice)}</span>
      {comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(Number(compareAtPrice))}</span>}
    </div>
  )
}
