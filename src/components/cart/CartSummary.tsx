"use client"

import { useState } from "react"
import { ShoppingCart, ArrowRight, Tag, TrendingDown, Truck, ShieldCheck, Gift, AlertTriangle, Percent, Layers } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"

interface CartSummaryProps {
  subtotal: number
  itemCount: number
  total: number
  tax?: number
  shipping?: number
  couponDiscount?: number
  couponCode?: string | null
  totalSavings?: number
  contractSavings?: number
  seasonalSavings?: number
  rolePriceSavings?: number
  tierSavings?: number
  appliedRoleName?: string
  ruleProductSavings?: number
  ruleCartSavings?: number
  ruleDiscountLabels?: string[]
  paymentMethodDiscount?: { discountAmount: number; ruleName: string } | null
  qtyDiscountSavings?: number
  extraCharges?: { chargeAmount: number; chargeLabel: string; ruleName: string }[]
  taxes?: { taxRate: number; taxLabel: string; ruleName: string }[]
  shippingOverride?: { shippingType: string; cost: number; ruleName: string } | null
  bogoFreeItems?: { freeProductId: string; freeQuantity: number; ruleName: string }[]
  checkoutRestrictions?: { restricted: boolean; message: string; ruleName: string }[]
  minimumOrderQuantities?: { productId?: string; minQty: number; ruleName: string }[]
  maximumOrderQuantities?: { productId?: string; maxQty: number; ruleName: string }[]
  cartItems?: { id: string; quantity: number; product: { id: string; title: string } }[]
  discountLabels?: string[]
  packageSavings?: number
  onApplyCoupon?: (code: string) => void
  onRemoveCoupon?: () => void
  couponLoading?: boolean
  couponError?: string
}

export default function CartSummary({
  subtotal, itemCount, total, tax = 0, shipping = 0,
  couponDiscount = 0, couponCode, totalSavings = 0,
  contractSavings = 0, seasonalSavings = 0, rolePriceSavings = 0,
  tierSavings = 0, appliedRoleName, ruleProductSavings = 0,
  ruleCartSavings = 0, ruleDiscountLabels = [],
  paymentMethodDiscount, qtyDiscountSavings = 0,
  extraCharges = [], taxes = [], shippingOverride,
  bogoFreeItems = [], checkoutRestrictions = [],
  minimumOrderQuantities = [], maximumOrderQuantities = [],
  cartItems = [], discountLabels = [], packageSavings = 0,
  onApplyCoupon, onRemoveCoupon, couponLoading, couponError,
}: CartSummaryProps) {
  const [code, setCode] = useState("")

  const isCheckoutBlocked = checkoutRestrictions.some(cr => cr.restricted)
    || minimumOrderQuantities.some(m => {
      const item = cartItems.find(ci => ci.product.id === m.productId)
      return item && item.quantity < m.minQty
    })
    || maximumOrderQuantities.some(m => {
      const item = cartItems.find(ci => ci.product.id === m.productId)
      return item && item.quantity > m.maxQty
    })

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <div className="card-base-static p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <ShoppingCart className="text-primary-600" size={20} />
          <h2 className="heading-sm">Order Summary</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Items ({itemCount})</span>
            <span className="font-medium text-gray-900">{formatPrice(subtotal)}</span>
          </div>
          {totalSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><TrendingDown size={14} className="text-green-500" /> Wholesale Savings</span>
              <span className="font-medium text-green-600">-{formatPrice(totalSavings)}</span>
            </div>
          )}
          {rolePriceSavings > 0 && appliedRoleName && (
            <div className="flex justify-between">
              <span className="text-gray-500">{appliedRoleName} Price Savings</span>
              <span className="font-medium text-purple-600">-{formatPrice(rolePriceSavings)}</span>
            </div>
          )}
          {tierSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><Layers size={14} className="text-emerald-500" /> Bulk Tier Savings</span>
              <span className="font-medium text-emerald-600">-{formatPrice(tierSavings)}</span>
            </div>
          )}
          {contractSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Contract Price Savings</span>
              <span className="font-medium text-green-600">-{formatPrice(contractSavings)}</span>
            </div>
          )}
          {seasonalSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Seasonal Discount</span>
              <span className="font-medium text-green-600">-{formatPrice(seasonalSavings)}</span>
            </div>
          )}
          {ruleProductSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><Percent size={14} className="text-green-500" />{ruleDiscountLabels.length > 0 ? `Discount (${ruleDiscountLabels.join(", ")})` : "Rule Discount"}</span>
              <span className="font-medium text-green-600">-{formatPrice(ruleProductSavings)}</span>
            </div>
          )}
          {ruleCartSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Cart Discount</span>
              <span className="font-medium text-green-600">-{formatPrice(ruleCartSavings)}</span>
            </div>
          )}
          {qtyDiscountSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><Layers size={14} className="text-cyan-500" /> Bulk Discount</span>
              <span className="font-medium text-green-600">-{formatPrice(qtyDiscountSavings)}</span>
            </div>
          )}
          {paymentMethodDiscount && paymentMethodDiscount.discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">{paymentMethodDiscount.ruleName}</span>
              <span className="font-medium text-green-600">-{formatPrice(paymentMethodDiscount.discountAmount)}</span>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Coupon ({couponCode})</span>
              <span className="font-medium text-green-600">-{formatPrice(couponDiscount)}</span>
            </div>
          )}
          {packageSavings > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><Layers size={14} className="text-primary-500" /> Package Savings</span>
              <span className="font-medium text-green-600">-{formatPrice(packageSavings)}</span>
            </div>
          )}
          {extraCharges.length > 0 && extraCharges.map((ec, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-gray-500">{ec.chargeLabel}</span>
              <span className="font-medium text-gray-900">{formatPrice(ec.chargeAmount)}</span>
            </div>
          ))}
          {taxes.length > 0 ? taxes.map((t, i) => {
            const taxAmount = (subtotal * t.taxRate) / 100
            return (
              <div key={i} className="flex justify-between">
                <span className="text-gray-500">{t.taxLabel} ({t.taxRate}%)</span>
                <span className="font-medium text-gray-900">{formatPrice(taxAmount)}</span>
              </div>
            )
          }) : tax > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tax (18% GST)</span>
              <span className="font-medium text-gray-900">{formatPrice(tax)}</span>
            </div>
          )}
          {shippingOverride ? (
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><Truck size={14} /> {shippingOverride.ruleName}</span>
              <span className="font-medium">{shippingOverride.cost > 0 ? formatPrice(shippingOverride.cost) : <span className="text-green-600 font-semibold">Free</span>}</span>
            </div>
          ) : shipping > 0 ? (
            <div className="flex justify-between">
              <span className="text-gray-500">Shipping</span>
              <span className="font-medium text-gray-900">{formatPrice(shipping)}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span className="text-gray-500">Shipping</span>
              <span className="font-medium text-green-600">Free</span>
            </div>
          )}
        </div>

        {bogoFreeItems.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-pink-600 flex items-center gap-1.5"><Gift size={12} /> Free Items (BOGO)</p>
            {bogoFreeItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-pink-700">{item.ruleName} — x{item.freeQuantity} free</span>
                <span className="text-pink-700 font-medium">{formatPrice(0)}</span>
              </div>
            ))}
          </div>
        )}

        {onApplyCoupon && (
          <div className="mt-5">
            {couponCode ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-100 px-4 py-3 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <Tag size={14} />
                  <span>Applied: {couponCode}</span>
                </div>
                <button onClick={onRemoveCoupon} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input-base flex-1"
                />
                <button
                  onClick={() => onApplyCoupon(code)}
                  disabled={couponLoading || !code}
                  className="btn-outline whitespace-nowrap"
                >
                  {couponLoading ? "..." : "Apply"}
                </button>
              </div>
            )}
            {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
          </div>
        )}

        <div className="border-t border-gray-100 my-5" />
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-primary-700">{formatPrice(total)}</span>
        </div>
        <Link
          href="/checkout"
          className={`mt-5 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 ${
            isCheckoutBlocked
              ? "bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          Proceed to Checkout <ArrowRight size={18} />
        </Link>

        {checkoutRestrictions.some(cr => cr.restricted) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
            {checkoutRestrictions.filter(cr => cr.restricted).map((cr, i) => (
              <p key={i} className="text-sm text-red-700 font-medium flex items-center gap-1.5"><AlertTriangle size={14} />{cr.message}</p>
            ))}
          </div>
        )}
        {minimumOrderQuantities.map((m, i) => {
          const item = cartItems.find(ci => ci.product.id === m.productId)
          if (!item || item.quantity >= m.minQty) return null
          return <p key={`min-${i}`} className="text-sm text-amber-700 mt-1 flex items-center gap-1.5"><AlertTriangle size={14} /> Min {m.minQty} units for {item.product.title}</p>
        })}
        {maximumOrderQuantities.map((m, i) => {
          const item = cartItems.find(ci => ci.product.id === m.productId)
          if (!item || item.quantity <= m.maxQty) return null
          return <p key={`max-${i}`} className="text-sm text-red-700 mt-1 flex items-center gap-1.5"><AlertTriangle size={14} /> Max {m.maxQty} units for {item.product.title}</p>
        })}
      </div>

      {/* Savings callout */}
      {(totalSavings > 0 || discountLabels.length > 0) && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingDown size={18} className="text-green-600" />
            <span className="font-semibold text-green-800">You&apos;re saving {formatPrice(totalSavings)}</span>
          </div>
          <p className="text-xs text-green-700">
            Wholesale tier pricing and bulk discounts are applied automatically to your order.
          </p>
          {discountLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {discountLabels.map((label, i) => (
                <span key={i} className="badge badge-primary">{label}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trust signals */}
      <div className="card-base-static p-4 space-y-3">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <ShieldCheck size={16} className="text-green-500 shrink-0" />
          <span>Secure checkout</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Truck size={16} className="text-blue-500 shrink-0" />
          <span>Free shipping on orders above {formatPrice(50000)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Tag size={16} className="text-primary-500 shrink-0" />
          <span>Bulk pricing applied automatically</span>
        </div>
      </div>

      {/* Estimated delivery */}
      <div className="card-base-static p-4">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Truck size={16} className="text-primary-500 shrink-0" />
          <span>Estimated delivery: <span className="font-semibold text-gray-900">3-5 business days</span></span>
        </div>
      </div>
    </div>
  )
}