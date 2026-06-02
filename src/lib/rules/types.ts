"use client"

export interface StorefrontRulesResult {
  /** Product IDs that should be hidden entirely (RESTRICT_PRODUCT_VISIBILITY) */
  hiddenProductIds: Set<string>
  /** Product IDs whose prices should be hidden (HIDDEN_PRICE) */
  hiddenPriceProductIds: Set<string>
  /** Products that cannot be purchased, mapped to their message (NON_PURCHASABLE) */
  nonPurchasableProducts: Map<string, string>
  /** Product-specific discounts from rules */
  productDiscounts: { productId: string; discountAmount: number; discountPercent: number; ruleName: string }[]
  /** Cart-level discount from rules */
  cartDiscount: { discountAmount: number; discountPercent: number; ruleName: string } | null
  /** Payment method-specific discount from rules */
  paymentMethodDiscount: { discountAmount: number; ruleName: string } | null
  /** BOGO offers (Buy X Get Y Free) from rules */
  bogo: { buyProductId: string; buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]
  /** Shipping rule result */
  shipping: { shippingType: string; cost: number; ruleName: string } | null
  /** Available payment methods from REQUIRED_QTY_FOR_PAYMENT_METHOD rules */
  availablePaymentMethods: { method: string; minQty: number | null }[]
  /** Minimum order quantities from rules */
  minimumOrderQuantities: { productId?: string; minQty: number; ruleName: string }[]
  /** Maximum order quantities from rules */
  maximumOrderQuantities: { productId?: string; maxQty: number; ruleName: string }[]
  /** Tax rules applied */
  taxes: { taxRate: number; taxLabel: string; ruleName: string }[]
  /** Checkout restrictions from rules */
  checkoutRestrictions: { restricted: boolean; message: string; ruleName: string }[]
  /** Quantity-based discount tiers from rules */
  quantityDiscounts: { productId?: string; tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }[]
  /** Extra charges / surcharges from rules */
  extraCharges: { chargeAmount: number; chargeLabel: string; ruleName: string }[]
  /** Whether the rules are still loading */
  loading: boolean
}

export function emptyStorefrontRules(): StorefrontRulesResult {
  return {
    hiddenProductIds: new Set(),
    hiddenPriceProductIds: new Set(),
    nonPurchasableProducts: new Map(),
    productDiscounts: [],
    cartDiscount: null,
    paymentMethodDiscount: null,
    bogo: [],
    shipping: null,
    availablePaymentMethods: [],
    minimumOrderQuantities: [],
    maximumOrderQuantities: [],
    taxes: [],
    checkoutRestrictions: [],
    quantityDiscounts: [],
    extraCharges: [],
    loading: false,
  }
}