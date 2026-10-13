import { formatPrice } from "@/lib/utils"
import { withGst, gstLabel } from "@/lib/useGstRates"

export interface RolePricingInfo {
  rolePrice: number
  savingsPercent?: number
  appliedRoleName?: string | null
  minQty?: number | null
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
  /** GST % to fold into every displayed amount (0/undefined = show prices as entered). */
  gstRate?: number
}

export function ProductPriceDisplay({
  isPriceHidden,
  rolePricing,
  ruleDiscount,
  unitPrice,
  compareAtPrice,
  tierPrices,
  size = "md",
  gstRate = 0,
}: ProductPriceDisplayProps) {
  const priceClass = size === "sm" ? "text-base font-bold" : "text-lg font-bold"
  const comparePrice = !!(compareAtPrice && Number(compareAtPrice) > Number(unitPrice))

  if (isPriceHidden) {
    return <span className="text-xs text-gray-500 italic">Login for pricing</span>
  }

  // Prices below are what the customer will actually pay per unit: entered price + GST.
  const g = (n: number | string) => formatPrice(withGst(Number(n), gstRate))
  const gstNote = gstRate > 0 ? <p className="text-[11px] text-gray-500 mt-0.5">{gstLabel(gstRate)}</p> : null

  if (rolePricing) {
    return (
      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`${priceClass} text-primary-700`}>{g(rolePricing.rolePrice)}</span>
          <span className="text-xs text-gray-400 line-through">{g(unitPrice)}</span>
          {rolePricing.savingsPercent !== undefined && (
            <span className="badge badge-success">{rolePricing.savingsPercent}% off</span>
          )}
        </div>
        {gstNote}
        {rolePricing.minQty != null && (
          <p className="text-[11px] text-gray-500 mt-0.5">Min quantity - {rolePricing.minQty}</p>
        )}
      </div>
    )
  }

  if (ruleDiscount) {
    return (
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={`${priceClass} text-primary-700`}>{g(Number(unitPrice) - ruleDiscount.discountAmount)}</span>
          <span className="text-xs text-gray-400 line-through">{g(unitPrice)}</span>
        </div>
        {gstNote}
      </div>
    )
  }

  if (tierPrices && tierPrices.length > 0) {
    return (
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-xs text-green-600 font-semibold">From</span>
          <span className={`${priceClass} text-gray-900`}>{g(tierPrices[tierPrices.length - 1].price)}</span>
          {comparePrice && <span className="text-xs text-gray-400 line-through">{g(Number(compareAtPrice))}</span>}
        </div>
        {gstNote}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className={`${priceClass} text-gray-900`}>{g(unitPrice)}</span>
        {comparePrice && <span className="text-xs text-gray-400 line-through">{g(Number(compareAtPrice))}</span>}
      </div>
      {gstNote}
    </div>
  )
}
