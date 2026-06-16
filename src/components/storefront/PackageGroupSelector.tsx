"use client"

import { Check } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface PackageGroup {
  id: string
  name: string
  description?: string
  required: boolean
  minSelect: number
  maxSelect: number
  discountType?: string
  discountValue?: number
  maxDiscount?: number
  categoryId?: string
  products: any[]
  defaultProductId?: string | null
}

interface Props {
  group: PackageGroup
  selectedProductId?: string
  onSelect: (productId: string) => void
}

export default function PackageGroupSelector({ group, selectedProductId, onSelect }: Props) {
  const discountBadge = group.discountType && group.discountValue
    ? group.discountType === "PERCENTAGE"
      ? `${group.discountValue}% off`
      : `₹${group.discountValue} off`
    : null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Group header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{group.name}</h3>
          {group.required && (
            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[11px] font-semibold rounded-full">
              Required
            </span>
          )}
          {discountBadge && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-semibold rounded-full">
              {discountBadge}
            </span>
          )}
        </div>
        {group.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>
        )}
      </div>

      {/* Products grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {group.products.map((product: any) => {
          const isSelected = selectedProductId === product.id
          const isDefault = product.isDefault

          return (
            <button
              key={product.id}
              onClick={() => onSelect(product.id)}
              className={`relative flex items-start gap-3 p-3 rounded-lg border-2 text-left transition ${
                isSelected
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {/* Selection indicator */}
              <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                isSelected
                  ? "border-primary-500 bg-primary-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}>
                {isSelected && <Check size={12} className="text-white" />}
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0 mb-2">
                  {product.thumbnail || product.images?.[0] ? (
                    <img src={product.thumbnail || product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-lg">📦</div>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.title}</p>
                <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-1">
                  {formatPrice(Number(product.unitPrice))}
                </p>
                {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatPrice(Number(product.compareAtPrice))}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}