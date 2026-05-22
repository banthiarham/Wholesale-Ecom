"use client"

import { ShoppingCart, ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"

interface Props {
  subtotal: number
  itemCount: number
  total: number
}

export default function CartSummary({ subtotal, itemCount, total }: Props) {
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
      </div>
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
