"use client"

import { useState } from "react"
import { ShoppingCart, ArrowRight, Tag } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"

interface Props {
  subtotal: number
  itemCount: number
  total: number
  tax?: number
  shipping?: number
  couponDiscount?: number
  couponCode?: string | null
  onApplyCoupon?: (code: string) => void
  onRemoveCoupon?: () => void
  couponLoading?: boolean
  couponError?: string
}

export default function CartSummary({
  subtotal,
  itemCount,
  total,
  tax = 0,
  shipping = 0,
  couponDiscount = 0,
  couponCode,
  onApplyCoupon,
  onRemoveCoupon,
  couponLoading,
  couponError,
}: Props) {
  const [code, setCode] = useState("")

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6">
        <ShoppingCart className="text-primary-600" size={20} />
        <h2 className="text-lg font-semibold">Order Summary</h2>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Items ({itemCount})</span>
          <span className="font-medium">{formatPrice(subtotal)}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tax (18% GST)</span>
            <span className="font-medium">{formatPrice(tax)}</span>
          </div>
        )}
        {shipping > 0 ? (
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping</span>
            <span className="font-medium">{formatPrice(shipping)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping</span>
            <span className="font-medium text-green-600">Free</span>
          </div>
        )}
        {couponDiscount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Coupon ({couponCode})</span>
            <span className="font-medium text-green-600">-{formatPrice(couponDiscount)}</span>
          </div>
        )}
      </div>

      {onApplyCoupon && (
        <div className="mt-4">
          {couponCode ? (
            <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Tag size={14} />
                <span>Applied: {couponCode}</span>
              </div>
              <button onClick={onRemoveCoupon} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter coupon code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={() => onApplyCoupon(code)}
                disabled={couponLoading || !code}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition disabled:opacity-50"
              >
                {couponLoading ? "..." : "Apply"}
              </button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
        </div>
      )}

      <hr className="my-4" />
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold">Total</span>
        <span className="text-xl font-bold text-primary-700">{formatPrice(total)}</span>
      </div>
      <Link href="/checkout" className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
        Proceed to Checkout
        <ArrowRight size={18} />
      </Link>
    </div>
  )
}
