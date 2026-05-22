"use client"

import { useState } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"

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

  return (
    <div className="flex gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
      <div className="w-24 h-24 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
        {item.product.thumbnail ? (
          <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900">{item.product.title}</h3>
            {item.product.sku && <p className="text-sm text-gray-500">SKU: {item.product.sku}</p>}
            <p className="text-xs text-gray-400 mt-1">MOQ: {item.product.moq}</p>
          </div>
          <button onClick={() => onRemove(item.id)} disabled={updating} className="text-red-500 hover:text-red-700 p-1">
            <Trash2 size={18} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setQty(Math.max(item.product.moq, qty - 1))} className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus size={14} /></button>
            <input type="number" min={item.product.moq} max={item.product.inventoryQuantity} value={qty} onChange={(e) => setQty(Number(e.target.value))} onBlur={() => qty !== item.quantity && qty >= item.product.moq && onUpdate(item.id, qty)} className="w-16 h-8 text-center border border-gray-200 rounded text-sm" />
            <button onClick={() => setQty(Math.min(item.product.inventoryQuantity, qty + 1))} className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus size={14} /></button>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900">{formatPrice(Number(item.unitPrice) * qty)}</p>
            <p className="text-xs text-gray-500">{formatPrice(Number(item.unitPrice))} / unit</p>
          </div>
        </div>
      </div>
    </div>
  )
}
