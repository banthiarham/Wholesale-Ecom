"use client"

import { useState } from "react"
import { Minus, Plus, Trash2, Link as LinkIcon, Tag } from "lucide-react"
import Link from "next/link"
import { formatPrice } from "@/lib/utils"

interface TierPrice { minQty: number; maxQty: number | null; price: string }

interface CartItem {
  id: string
  quantity: number
  unitPrice: number
  product: {
    id: string
    title: string
    handle: string
    sku: string | null
    thumbnail: string | null
    moq: number
    inventoryQuantity: number
    unitPrice: string
    compareAtPrice: string | null
    tierPrices: TierPrice[]
  }
}

interface Props {
  item: CartItem
  onUpdate: (itemId: string, quantity: number) => void
  onRemove: (itemId: string) => void
  updating: boolean
}

export default function CartItemCard({ item, onUpdate, onRemove, updating }: Props) {
  const [qty, setQty] = useState(item.quantity)
  const listPrice = Number(item.product.unitPrice)
  const effectivePrice = Number(item.unitPrice)
  const savingsPerUnit = listPrice - effectivePrice
  const totalSavings = savingsPerUnit * item.quantity
  const hasDiscount = savingsPerUnit > 0

  const getNextTier = (): TierPrice | null => {
    if (!item.product.tierPrices || item.product.tierPrices.length === 0) return null
    const sorted = [...item.product.tierPrices].sort((a, b) => a.minQty - b.minQty)
    return sorted.find((tp) => tp.minQty > item.quantity) || null
  }

  const nextTier = getNextTier()

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="flex gap-4 p-5">
        {/* Thumbnail */}
        <Link href={`/products/${item.product.handle}`} className="shrink-0">
          <div className="w-28 h-28 bg-gray-100 rounded-lg overflow-hidden">
            {item.product.thumbnail ? (
              <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl font-bold">
                {item.product.title[0]}
              </div>
            )}
          </div>
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={`/products/${item.product.handle}`} className="font-semibold text-gray-900 hover:text-primary-600 transition">
                {item.product.title}
              </Link>
              {item.product.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {item.product.sku}</p>}
              <p className="text-xs text-gray-400">MOQ: {item.product.moq}</p>
            </div>
            <button onClick={() => onRemove(item.id)} disabled={updating} className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove">
              <Trash2 size={16} />
            </button>
          </div>

          {/* Pricing row */}
          <div className="mt-3 flex items-end justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900">{formatPrice(effectivePrice)}</span>
                <span className="text-sm text-gray-400">/ unit</span>
              </div>
              {hasDiscount && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-400 line-through">{formatPrice(listPrice)}</span>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                    {Math.round((savingsPerUnit / listPrice) * 100)}% off
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatPrice(effectivePrice * item.quantity)}</p>
              {hasDiscount && (
                <p className="text-xs text-green-600 font-medium">You save {formatPrice(totalSavings)}</p>
              )}
            </div>
          </div>

          {/* Quantity controls */}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQty(Math.max(item.product.moq, qty - 1))}
                disabled={updating}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition disabled:opacity-50"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={item.product.moq}
                max={item.product.inventoryQuantity}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                onBlur={() => qty !== item.quantity && qty >= item.product.moq && onUpdate(item.id, qty)}
                className="w-16 h-8 text-center border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={() => setQty(Math.min(item.product.inventoryQuantity, qty + 1))}
                disabled={updating}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition disabled:opacity-50"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs text-gray-400 ml-2">{item.product.inventoryQuantity} available</span>
            </div>
          </div>

          {/* Next tier hint */}
          {nextTier && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <Tag size={14} className="text-blue-500 shrink-0" />
              <p className="text-xs text-blue-700">
                Add <span className="font-bold">{nextTier.minQty - item.quantity}</span> more to unlock <span className="font-bold">{formatPrice(nextTier.price)}/unit</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}