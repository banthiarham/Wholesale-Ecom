"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Heart, Star, Package, ShoppingCart, Sparkles, Minus, Plus } from "lucide-react"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"
import { SeasonalDiscount, PaymentOffer, discountBadge, getPaymentOfferBadge } from "@/lib/pricing"
import { getContrastTextColor, isExternalImageUrl } from "@/lib/utils"
import { ProductPriceDisplay, RolePricingInfo, RuleDiscountInfo } from "./ProductPriceDisplay"

export interface ProductCardProduct {
  id: string
  title: string
  handle: string
  thumbnail?: string | null
  images?: string[]
  sku?: string | null
  unitPrice: number | string
  compareAtPrice?: number | string | null
  moq: number
  inventoryQuantity?: number
  rating?: number
  reviewCount?: number
  tags?: string[]
  categoryId?: string
  category?: { id?: string; name: string; handle: string }
  tierPrices?: { minQty: number; maxQty: number | null; price: number | string }[]
}

interface BogoInfo {
  buyQuantity: number
  freeProductId: string
  freeQuantity: number
  ruleName: string
}

interface QuantityDiscountInfo {
  tiers: { minQty: number; discountType: string; discountValue: number }[]
  ruleName: string
}

export interface CustomBadgeInfo {
  productId: string
  badgeLabel: string
  badgeColor: string | null
  ruleName: string
}

export interface ProductCardProps {
  product: ProductCardProduct
  view?: "grid" | "list"
  isPriceHidden?: boolean
  isNonPurchasable?: boolean
  nonPurchasableMsg?: string
  rolePricing?: RolePricingInfo | null
  ruleDiscount?: RuleDiscountInfo | null
  bogo?: BogoInfo[]
  quantityDiscount?: QuantityDiscountInfo | null
  customBadges?: CustomBadgeInfo[]
  seasonalDiscount?: SeasonalDiscount | null
  paymentOffers?: PaymentOffer[]
  isWishlisted?: boolean
  onToggleWishlist?: (e: React.MouseEvent, productId: string) => void
  isAdding?: boolean
  onAddToCart: (productId: string, qty: number) => void
  addToCartLabel?: string
  outOfStockLabel?: string
  addingLabel?: string
  /** Grid view only: show a quantity box (− 1 +) next to the Add to Cart button. */
  showQuantity?: boolean
  /** Grid view only: shorter image area, for dense 5-per-row listings. */
  compact?: boolean
}

export function ProductCard({
  product,
  view = "grid",
  isPriceHidden,
  isNonPurchasable,
  nonPurchasableMsg,
  rolePricing,
  ruleDiscount,
  bogo,
  quantityDiscount,
  customBadges,
  seasonalDiscount,
  paymentOffers,
  isWishlisted,
  onToggleWishlist,
  isAdding,
  onAddToCart,
  addToCartLabel = "Add to Cart",
  outOfStockLabel = "Out of Stock",
  addingLabel = "Adding...",
  showQuantity = false,
  compact = false,
}: ProductCardProps) {
  const [qty, setQty] = useState<number>(Math.max(1, product.moq || 1))
  const maxQty = product.inventoryQuantity && product.inventoryQuantity > 0 ? product.inventoryQuantity : Infinity
  const clampQty = (n: number) => Math.min(maxQty, Math.max(Math.max(1, product.moq || 1), Math.floor(Number.isFinite(n) ? n : 1)))
  const isOutOfStock = (product.inventoryQuantity ?? Infinity) <= 0
  const compareAtNum = product.compareAtPrice != null ? Number(product.compareAtPrice) : null
  const discountPct = compareAtNum && compareAtNum > Number(product.unitPrice)
    ? Math.round(((compareAtNum - Number(product.unitPrice)) / compareAtNum) * 100)
    : null
  const matchedPaymentOffer = paymentOffers?.find(
    (o) =>
      o.productId === product.id ||
      (product.categoryId && o.categoryId === product.categoryId) ||
      (product.category?.id && o.categoryId === product.category.id) ||
      (!o.productId && !o.categoryId)
  )

  const ruleBadge = (size: "sm" | "md") => (
    <ProductRuleBadge
      priceHidden={isPriceHidden}
      nonPurchasable={isNonPurchasable}
      nonPurchasableMessage={nonPurchasableMsg}
      hasRolePrice={!!rolePricing}
      roleLabel={rolePricing?.appliedRoleName || undefined}
      bogoLabel={bogo && bogo.length > 0 ? `Buy ${bogo[0].buyQuantity} Get ${bogo[0].freeQuantity} Free` : undefined}
      quantityDiscountLabel={quantityDiscount ? quantityDiscount.ruleName : undefined}
      discountLabel={ruleDiscount?.ruleName}
      discountPercent={ruleDiscount?.discountPercent}
      size={size}
    />
  )

  // Admin-configured Dynamic Rule badge (any rule type with a badgeLabel set), shown as an
  // overlay on the product image rather than in ProductRuleBadge's below-image row, per the
  // top-left-of-image placement requirement. When multiple rules apply to this product, the
  // first entry wins — the backend already returns customBadges ordered by rule priority
  // (existing DynamicRule.priority, lower = higher precedence), so no new ordering logic here.
  // Rendered as the first child of the existing top-left badge stack (not independently
  // absolute-positioned) so it sits at the true top-left corner and other badges (seasonal
  // discount, Bulk, Best Seller) stack beneath it rather than overlapping it.
  const topRuleBadge = customBadges?.find((b) => b.productId === product.id)
  const dynamicRuleBadge = topRuleBadge ? (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm max-w-[8.5rem] truncate self-start"
      style={{ backgroundColor: topRuleBadge.badgeColor || "#7c3aed", color: getContrastTextColor(topRuleBadge.badgeColor || "#7c3aed") }}
      title={topRuleBadge.badgeLabel}
    >
      <Sparkles size={10} className="shrink-0" />
      <span className="truncate">{topRuleBadge.badgeLabel}</span>
    </span>
  ) : null

  const priceDisplay = (size: "sm" | "md") => (
    <ProductPriceDisplay
      isPriceHidden={isPriceHidden}
      rolePricing={rolePricing}
      ruleDiscount={ruleDiscount}
      unitPrice={product.unitPrice}
      compareAtPrice={product.compareAtPrice}
      tierPrices={product.tierPrices}
      size={size}
    />
  )

  const addToCartButton = (variant: "list" | "grid") => {
    if (isNonPurchasable) return null
    const disabled = isAdding || isOutOfStock
    const label = isAdding ? addingLabel : isOutOfStock ? outOfStockLabel : addToCartLabel
    if (variant === "list") {
      const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }
      const minQty = Math.max(1, product.moq || 1)
      return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full" onClick={stop}>
          <div className="flex items-center self-start sm:self-auto border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <button type="button" onClick={(e) => { stop(e); setQty((q) => clampQty(q - 1)) }} disabled={disabled || qty <= minQty} className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Decrease quantity"><Minus size={14} /></button>
            <input
              type="number" min={minQty} value={qty} disabled={disabled} aria-label="Quantity"
              onChange={(e) => setQty(Number(e.target.value))}
              onBlur={() => setQty((q) => clampQty(q))}
              onKeyDown={(e) => { if (e.key === "Enter") { stop(e); setQty((q) => clampQty(q)) } }}
              className="w-12 h-10 text-center text-sm font-semibold border-x border-gray-200 focus:outline-none focus:bg-gray-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button type="button" onClick={(e) => { stop(e); setQty((q) => clampQty(q + 1)) }} disabled={disabled} className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Increase quantity"><Plus size={14} /></button>
          </div>
          <button
            type="button"
            onClick={(e) => { stop(e); onAddToCart(product.id, clampQty(qty)) }}
            disabled={disabled}
            className="w-full sm:w-auto sm:flex-1 min-w-0 h-10 shrink-0 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <ShoppingCart size={16} className="shrink-0" /> <span className="truncate">{label}</span>
          </button>
        </div>
      )
    }
    if (showQuantity) {
      const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }
      return (
        <div className="mt-3 flex flex-col xl:flex-row xl:items-center gap-2" onClick={stop}>
          <div className="flex items-center justify-between xl:justify-start border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <button type="button" onClick={(e) => { stop(e); setQty((q) => clampQty(q - 1)) }} disabled={disabled || qty <= Math.max(1, product.moq || 1)} className="w-9 xl:w-7 h-9 xl:h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Decrease quantity"><Minus size={12} /></button>
            <input
              type="number" min={Math.max(1, product.moq || 1)} value={qty} disabled={disabled} aria-label="Quantity"
              onChange={(e) => setQty(Number(e.target.value))}
              onBlur={() => setQty((q) => clampQty(q))}
              onKeyDown={(e) => { if (e.key === "Enter") { stop(e); setQty((q) => clampQty(q)) } }}
              className="w-full xl:w-10 h-9 xl:h-8 text-center text-xs font-semibold border-x border-gray-200 focus:outline-none focus:bg-gray-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button type="button" onClick={(e) => { stop(e); setQty((q) => clampQty(q + 1)) }} disabled={disabled} className="w-9 xl:w-7 h-9 xl:h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Increase quantity"><Plus size={12} /></button>
          </div>
          <button
            type="button"
            onClick={(e) => { stop(e); onAddToCart(product.id, clampQty(qty)) }}
            disabled={disabled}
            className="w-full xl:flex-1 min-w-0 h-9 xl:h-8 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
          >
            <ShoppingCart size={13} className="shrink-0" /> <span className="truncate">{label}</span>
          </button>
        </div>
      )
    }
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(product.id, product.moq) }}
        disabled={disabled}
        className="mt-3 w-full py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold tracking-wide hover:bg-primary-700 active:bg-primary-800 active:scale-[0.97] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100 shadow-[0_1px_2px_rgba(2,84,129,0.06),0_6px_16px_-6px_rgba(2,84,129,0.35)]"
      >
        <ShoppingCart size={13} /> {label}
      </button>
    )
  }

  const wishlistButton = onToggleWishlist ? (
    <button
      onClick={(e) => onToggleWishlist(e, product.id)}
      className={`p-2 rounded-full shadow-md backdrop-blur-md transition-all duration-200 hover:scale-110 ${isWishlisted ? "bg-red-50 text-red-500" : "bg-white/95 text-gray-500 hover:text-red-500"}`}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart size={14} fill={isWishlisted ? "currentColor" : "none"} />
    </button>
  ) : null

  const ratingRow = (size: "sm" | "md", textClass: string) =>
    (product.rating ?? 0) > 0 && (
      <>
        <span className={`inline-flex items-center gap-0.5 font-bold text-white bg-green-600 rounded ${size === "sm" ? "text-[10px] px-1 py-0.5" : "text-xs px-1.5 py-0.5"}`}>
          {product.rating!.toFixed(1)} <Star size={size === "sm" ? 8 : 9} className="fill-white" />
        </span>
        <span className={textClass}>({product.reviewCount ?? 0})</span>
      </>
    )

  const stockDot = (isOos: boolean, isLow: boolean) => (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOos ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-green-400"}`} />
  )

  if (view === "list") {
    const listLowStock = !isOutOfStock && (product.inventoryQuantity ?? Infinity) <= Math.max(product.moq * 2, 20)
    return (
      <Link href={`/products/${product.handle}`} className="card-interactive flex gap-4 p-3 sm:p-4 group h-full">
        <div className="relative w-28 sm:w-40 lg:w-44 shrink-0 self-start aspect-square rounded-xl bg-white border border-gray-100 overflow-hidden">
          {product.thumbnail ? (
            <Image src={product.thumbnail} alt={product.title} fill unoptimized={isExternalImageUrl(product.thumbnail)} className="img-zoom object-contain p-1" sizes="176px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <Package size={32} className="text-gray-200" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1 max-w-[calc(100%-1rem)]">
            {dynamicRuleBadge}
            {discountPct !== null && <span className="chip-sale">{discountPct}% OFF</span>}
            {seasonalDiscount && <span className="chip-sale">{discountBadge(seasonalDiscount)}</span>}
            {product.tierPrices && product.tierPrices.length > 0 && <span className="chip-bulk">Bulk</span>}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 tracking-tight group-hover:text-primary-600 transition-colors line-clamp-2">{product.title}</h3>
            {wishlistButton && <div className="shrink-0 -mt-1 -mr-1">{wishlistButton}</div>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {ratingRow("md", "text-xs text-gray-400")}
            {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
          </div>
          <div className="flex items-end justify-between gap-3 mt-2 flex-wrap">
            {priceDisplay("md")}
            <span className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">MOQ {rolePricing?.minQty ?? product.moq}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">{ruleBadge("md")}</div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-1.5">
            {stockDot(isOutOfStock, listLowStock)}
            {isOutOfStock ? (
              <span className="text-red-500">Out of stock</span>
            ) : listLowStock ? (
              <span className="text-amber-600">Only {product.inventoryQuantity} left</span>
            ) : (
              <span className="text-green-600">In stock</span>
            )}
          </span>
          <div className="mt-auto pt-3">{addToCartButton("list")}</div>
        </div>
      </Link>
    )
  }

  const lowStock = !isOutOfStock && (product.inventoryQuantity ?? Infinity) <= Math.max(product.moq * 2, 20)

  return (
    <Link href={`/products/${product.handle}`} className="card-interactive group flex flex-col h-full">
      <div className="relative bg-white overflow-hidden aspect-square">
        {product.thumbnail ? (
          <Image src={product.thumbnail} alt={product.title} fill unoptimized={isExternalImageUrl(product.thumbnail)} className="img-zoom object-contain p-2" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package size={40} className="text-gray-200" />
          </div>
        )}
        {/* Subtle top scrim keeps badges legible over busy photography */}
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/[0.08] to-transparent pointer-events-none" />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1 max-w-[calc(100%-1.25rem)]">
          {dynamicRuleBadge}
          {seasonalDiscount && <span className="chip-sale">{discountBadge(seasonalDiscount)}</span>}
          {product.tierPrices && product.tierPrices.length > 0 && <span className="chip-bulk">Bulk</span>}
          {product.tags?.includes("best-seller") && <span className="chip-bestseller">Best Seller</span>}
        </div>
        {discountPct !== null && (
          <span className="absolute bottom-2.5 left-2.5 chip-sale">{discountPct}% OFF</span>
        )}
        {onToggleWishlist && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {wishlistButton}
          </div>
        )}
        {matchedPaymentOffer && (
          <span className={`absolute bottom-2.5 right-2.5 ${matchedPaymentOffer.offerType === "BANK" ? "bg-blue-600" : "bg-purple-600"} text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm`}>
            {getPaymentOfferBadge(matchedPaymentOffer)}
          </span>
        )}
      </div>
      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug min-h-[2.5rem]">{product.title}</h3>
        <div className="flex items-center gap-1.5 mt-1.5">{ratingRow("sm", "text-[11px] text-gray-400")}
          {product.sku && <span className="text-[11px] text-gray-400">· {product.sku}</span>}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 mt-2">
          <div className="min-w-0">{priceDisplay("sm")}</div>
          <span className="shrink-0 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 px-1.5 py-1 rounded-md">MOQ {rolePricing?.minQty ?? product.moq}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">{ruleBadge("sm")}</div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1">
            {stockDot(isOutOfStock, lowStock)}
            {isOutOfStock ? (
              <span className="text-red-500">Out of stock</span>
            ) : lowStock ? (
              <span className="text-amber-600">Only {product.inventoryQuantity} left</span>
            ) : (
              <span className="text-green-600">In stock</span>
            )}
          </span>
        </div>
        <div className="mt-auto">{addToCartButton("grid")}</div>
      </div>
    </Link>
  )
}
