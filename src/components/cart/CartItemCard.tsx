"use client"

import { useState, useEffect, useRef } from "react"
import { Minus, Plus, Trash2, Link as LinkIcon, Tag, Gift, Layers, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatPrice, getContrastTextColor } from "@/lib/utils"

interface TierPrice { minQty: number; maxQty: number | null; price: string }

interface CartItem {
  id: string; quantity: number; unitPrice: number
  product: { id: string; title: string; handle: string; sku: string | null; thumbnail: string | null; moq: number; inventoryQuantity: number; unitPrice: string; compareAtPrice: string | null; tierPrices: TierPrice[] }
}

interface RuleProductDiscount { discountAmount: number; discountPercent: number; ruleName: string }
interface BogoOffer { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }
interface QuantityDiscount { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }

interface Props {
  item: CartItem
  onUpdate: (itemId: string, quantity: number) => void
  onRemove: (itemId: string) => void
  updating: boolean
  ruleProductDiscount?: RuleProductDiscount | null
  bogoOffers?: BogoOffer[]
  quantityDiscount?: QuantityDiscount | null
  minQtyRule?: { minQty: number; ruleName: string } | null
  maxQtyRule?: { maxQty: number; ruleName: string } | null
}

function findTierForQty(tierPrices: TierPrice[], qty: number): TierPrice | null {
  if (!tierPrices || tierPrices.length === 0) return null
  const sorted = [...tierPrices].sort((a, b) => a.minQty - b.minQty)
  return sorted.find((tp) => qty >= tp.minQty && (!tp.maxQty || qty <= tp.maxQty)) || null
}

function findNextTier(tierPrices: TierPrice[], qty: number): TierPrice | null {
  if (!tierPrices || tierPrices.length === 0) return null
  const sorted = [...tierPrices].sort((a, b) => a.minQty - b.minQty)
  return sorted.find((tp) => tp.minQty > qty) || null
}

export default function CartItemCard({ item, onUpdate, onRemove, updating, ruleProductDiscount, bogoOffers, quantityDiscount, minQtyRule, maxQtyRule }: Props) {
  const [qty, setQty] = useState(item.quantity)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQty(item.quantity) }, [item.quantity])

  const listPrice = Number(item.product.unitPrice)
  const effectivePrice = Number(item.unitPrice)
  const ruleDiscountPerUnit = ruleProductDiscount?.discountAmount ?? 0
  const finalPrice = effectivePrice - ruleDiscountPerUnit
  const savingsPerUnit = listPrice - finalPrice
  const totalSavings = savingsPerUnit * item.quantity
  const hasDiscount = savingsPerUnit > 0

  const pricingMetadata = (item as any).metadata?.pricing
  const rolePrice = pricingMetadata?.rolePrice
  const appliedRoleName = pricingMetadata?.appliedRoleName
  const hasRolePrice = rolePrice && rolePrice < listPrice
  const tierPrice = pricingMetadata?.tierPrice
  const hasTierPrice = tierPrice && tierPrice < listPrice && !hasRolePrice && !(pricingMetadata?.contractPrice && pricingMetadata.contractPrice < tierPrice)

  const sortedTierPrices = item.product.tierPrices?.length
    ? [...item.product.tierPrices].sort((a, b) => a.minQty - b.minQty)
    : []
  const currentTier = findTierForQty(sortedTierPrices, qty)
  const nextTier = findNextTier(sortedTierPrices, qty)

  const optimisticTierPrice = currentTier ? Number(currentTier.price) : null
  const showOptimisticPrice = optimisticTierPrice !== null && Math.abs(optimisticTierPrice - effectivePrice) > 0.01
  const displayPrice = showOptimisticPrice ? optimisticTierPrice : finalPrice
  const displayTotal = displayPrice * qty
  const displaySavings = (listPrice - displayPrice) * qty

  const handleQtyChange = (newQty: number) => {
    const clampedQty = Math.max(item.product.moq, Math.min(item.product.inventoryQuantity, newQty))
    setQty(clampedQty)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { if (clampedQty !== item.quantity) onUpdate(item.id, clampedQty) }, 400)
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="flex gap-4 p-5">
        {/* Thumbnail */}
        <Link href={`/products/${item.product.handle}`} className="shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-50 rounded-xl overflow-hidden">
            {item.product.thumbnail ? (
              <img src={item.product.thumbnail} alt={item.product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <span className="text-2xl font-bold text-gray-200">{item.product.title[0]}</span>
              </div>
            )}
          </div>
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={`/products/${item.product.handle}`} className="font-semibold text-gray-900 hover:text-primary-600 transition-colors">{item.product.title}</Link>
              {item.product.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {item.product.sku}</p>}
              <p className="text-xs text-gray-400">MOQ: {item.product.moq}</p>
            </div>
            <button onClick={() => onRemove(item.id)} disabled={updating} className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove"><Trash2 size={16} /></button>
          </div>

          {/* Pricing */}
          <div className="mt-3 flex items-end justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900">{formatPrice(displayPrice)}</span>
                <span className="text-sm text-gray-400">/ unit</span>
                {showOptimisticPrice && <span className="text-xs text-amber-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin" />updating...</span>}
              </div>
              {ruleProductDiscount && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="badge bg-green-600 text-white">{ruleProductDiscount.ruleName}</span>
                  <span className="text-xs font-semibold text-green-600">{ruleProductDiscount.discountPercent}% off</span>
                </div>
              )}
              {hasTierPrice && !ruleProductDiscount && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="badge bg-emerald-600 text-white">Bulk Price</span>
                  {currentTier && <span className="text-xs text-emerald-700">{currentTier.minQty}+ units</span>}
                </div>
              )}
              {hasRolePrice && !ruleProductDiscount && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="badge" style={{ backgroundColor: "#7c3aed", color: getContrastTextColor("#7c3aed") }}>{appliedRoleName} Price</span>
                </div>
              )}
              {hasDiscount && !ruleProductDiscount && !hasTierPrice && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-400 line-through">{formatPrice(listPrice)}</span>
                  <span className="badge badge-success">{Math.round((savingsPerUnit / listPrice) * 100)}% off</span>
                </div>
              )}
              {hasTierPrice && !ruleProductDiscount && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-400 line-through">{formatPrice(listPrice)}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatPrice(displayTotal)}</p>
              {(hasDiscount || showOptimisticPrice) && displaySavings > 0 && (
                <p className="text-xs text-green-600 font-medium">You save {formatPrice(displaySavings)}</p>
              )}
            </div>
          </div>

          {/* BOGO */}
          {bogoOffers && bogoOffers.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-pink-50 rounded-xl">
              <Gift size={14} className="text-pink-500 shrink-0" />
              <p className="text-xs text-pink-700"><span className="font-semibold">BOGO:</span> Buy {bogoOffers[0].buyQuantity}, Get {bogoOffers[0].freeQuantity} Free ({bogoOffers[0].ruleName})</p>
            </div>
          )}

          {/* Quantity discount */}
          {quantityDiscount && (
            <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-xl">
              <Layers size={14} className="text-cyan-500 shrink-0" />
              <div className="text-xs text-cyan-700">
                <span className="font-semibold">{quantityDiscount.ruleName}</span>
                <div className="mt-0.5">
                  {quantityDiscount.tiers.sort((a, b) => a.minQty - b.minQty).map(t => (
                    <span key={t.minQty} className="mr-2">{t.minQty}+: {t.discountType === "PERCENTAGE" ? `${t.discountValue}%` : formatPrice(t.discountValue)} off</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quantity controls */}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleQtyChange(qty - 1)} disabled={updating} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition disabled:opacity-50"><Minus size={14} /></button>
              <input
                type="number" min={item.product.moq} max={item.product.inventoryQuantity} value={qty}
                onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setQty(v) }}
                onBlur={() => { const clampedQty = Math.max(item.product.moq, Math.min(item.product.inventoryQuantity, qty)); setQty(clampedQty); if (clampedQty !== item.quantity) onUpdate(item.id, clampedQty) }}
                onKeyDown={(e) => { if (e.key === "Enter") { const clampedQty = Math.max(item.product.moq, Math.min(item.product.inventoryQuantity, qty)); setQty(clampedQty); if (clampedQty !== item.quantity) onUpdate(item.id, clampedQty) } }}
                className="w-16 h-8 text-center border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={() => handleQtyChange(qty + 1)} disabled={updating} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition disabled:opacity-50"><Plus size={14} /></button>
              <span className="text-xs text-gray-400 ml-2">{item.product.inventoryQuantity} available</span>
            </div>
          </div>

          {/* Min/Max qty warnings */}
          {(minQtyRule || maxQtyRule) && (
            <div className="mt-1.5 space-y-0.5">
              {minQtyRule && qty < minQtyRule.minQty && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Min. {minQtyRule.minQty} units</p>}
              {maxQtyRule && qty > maxQtyRule.maxQty && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> Max. {maxQtyRule.maxQty} units</p>}
            </div>
          )}

          {/* Next tier hint */}
          {nextTier && (
            <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl">
              <Tag size={14} className="text-blue-500 shrink-0" />
              <p className="text-xs text-blue-700">
                Add <span className="font-bold">{nextTier.minQty - qty}</span> more to unlock <span className="font-bold">{formatPrice(nextTier.price)}/unit</span>
                {listPrice > Number(nextTier.price) && <span className="ml-1">({Math.round(((listPrice - Number(nextTier.price)) / listPrice) * 100)}% savings)</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}