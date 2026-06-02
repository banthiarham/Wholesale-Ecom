"use client"

import { Lock, EyeOff, ShieldCheck, Gift, Layers, PlusCircle, Truck, Percent } from "lucide-react"

interface ProductRuleBadgeProps {
  /** Whether the product's price should be hidden */
  priceHidden?: boolean
  /** Whether the product is not purchasable */
  nonPurchasable?: boolean
  /** Message for non-purchasable products */
  nonPurchasableMessage?: string
  /** Whether a role-based price is being applied (exclusive pricing) */
  hasRolePrice?: boolean
  /** Role label for exclusive pricing badge */
  roleLabel?: string
  /** Role color for exclusive pricing badge */
  roleColor?: string | null
  /** Size variant */
  size?: "sm" | "md"
  /** BOGO offer label */
  bogoLabel?: string
  /** Quantity discount label */
  quantityDiscountLabel?: string
  /** Extra charge label */
  extraChargeLabel?: string
  /** Shipping rule label */
  shippingLabel?: string
  /** Product / cart discount label */
  discountLabel?: string
  /** Discount percent for badge */
  discountPercent?: number
}

/**
 * Renders rule-based badges on product cards:
 * - "Login for pricing" when price is hidden
 * - "Unavailable for purchase" when non-purchasable
 * - "Exclusive pricing" when role price applies
 * - BOGO, bulk discount, surcharge, shipping, and discount badges
 */
export default function ProductRuleBadge({
  priceHidden,
  nonPurchasable,
  nonPurchasableMessage,
  hasRolePrice,
  roleLabel,
  roleColor,
  size = "sm",
  bogoLabel,
  quantityDiscountLabel,
  extraChargeLabel,
  shippingLabel,
  discountLabel,
  discountPercent,
}: ProductRuleBadgeProps) {
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
  const iconSize = size === "sm" ? 10 : 12

  if (priceHidden) {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-gray-100 text-gray-600 font-medium`}>
        <EyeOff size={iconSize} />
        Login for pricing
      </span>
    )
  }

  if (nonPurchasable) {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-red-50 text-red-600 font-medium`}>
        <Lock size={iconSize} />
        {nonPurchasableMessage || "Unavailable for purchase"}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {hasRolePrice && roleLabel && (
        <span
          className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-medium text-white`}
          style={{ backgroundColor: roleColor || "#7c3aed" }}
        >
          <ShieldCheck size={iconSize} />
          {roleLabel} Price
        </span>
      )}
      {discountLabel && discountPercent !== undefined && discountPercent > 0 && (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-green-50 text-green-700 font-medium border border-green-200`}>
          <Percent size={iconSize} />
          {discountPercent}% off
        </span>
      )}
      {bogoLabel && (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-pink-50 text-pink-700 font-medium border border-pink-200`}>
          <Gift size={iconSize} />
          {bogoLabel}
        </span>
      )}
      {quantityDiscountLabel && (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-cyan-50 text-cyan-700 font-medium border border-cyan-200`}>
          <Layers size={iconSize} />
          {quantityDiscountLabel}
        </span>
      )}
      {extraChargeLabel && (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200`}>
          <PlusCircle size={iconSize} />
          {extraChargeLabel}
        </span>
      )}
      {shippingLabel && (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full bg-orange-50 text-orange-700 font-medium border border-orange-200`}>
          <Truck size={iconSize} />
          {shippingLabel}
        </span>
      )}
    </div>
  )
}