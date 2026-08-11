"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, Star, Package, ShoppingCart, Sparkles } from "lucide-react"
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
}: ProductCardProps) {
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
      return (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(product.id, product.moq) }}
          disabled={disabled}
          className="btn-primary text-sm py-2.5 px-6"
        >
          {label}
        </button>
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
      <Link href={`/products/${product.handle}`} className="card-interactive flex group">
        <div className="relative w-44 sm:w-52 flex-shrink-0 bg-gray-50 overflow-hidden">
          <div className="relative w-full h-full min-h-[160px]">
            {product.thumbnail ? (
              <Image src={product.thumbnail} alt={product.title} fill unoptimized={isExternalImageUrl(product.thumbnail)} className="img-zoom object-cover" sizes="208px" />
            ) : (
              <div className="w-full h-full min-h-[160px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <Package size={32} className="text-gray-200" />
              </div>
            )}
            <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
              {dynamicRuleBadge}
              {discountPct !== null && <span className="chip-sale">{discountPct}% OFF</span>}
              {seasonalDiscount && <span className="chip-sale">{discountBadge(seasonalDiscount)}</span>}
            </div>
            {product.tierPrices && product.tierPrices.length > 0 && <span className="absolute top-2.5 right-2.5 chip-bulk">Bulk</span>}
            {onToggleWishlist && (
              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {wishlistButton}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 p-5 sm:p-6 flex flex-col">
          <h3 className="font-bold text-gray-900 tracking-tight group-hover:text-primary-600 transition-colors line-clamp-2">{product.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            {ratingRow("md", "text-xs text-gray-400")}
            {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
          </div>
          <div className="flex items-end justify-between gap-3 mt-2.5 flex-wrap">
            {priceDisplay("md")}
            <span className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">MOQ {product.moq}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">{ruleBadge("md")}</div>
          <div className="mt-auto pt-4 flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              {stockDot(isOutOfStock, listLowStock)}
              {isOutOfStock ? (
                <span className="text-red-500">Out of stock</span>
              ) : listLowStock ? (
                <span className="text-amber-600">Only {product.inventoryQuantity} left</span>
              ) : (
                <span className="text-green-600">In stock</span>
              )}
            </span>
            <div className="ml-auto">{addToCartButton("list")}</div>
          </div>
        </div>
      </Link>
    )
  }

  const lowStock = !isOutOfStock && (product.inventoryQuantity ?? Infinity) <= Math.max(product.moq * 2, 20)

  return (
    <Link href={`/products/${product.handle}`} className="card-interactive group flex flex-col h-full">
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.thumbnail ? (
          <Image src={product.thumbnail} alt={product.title} fill unoptimized={isExternalImageUrl(product.thumbnail)} className="img-zoom object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
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
      <div className="p-3.5 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug min-h-[2.5rem]">{product.title}</h3>
        <div className="flex items-center gap-1.5 mt-1.5">{ratingRow("sm", "text-[11px] text-gray-400")}
          {product.sku && <span className="text-[11px] text-gray-400">· {product.sku}</span>}
        </div>
        <div className="flex items-end justify-between gap-2 mt-2">
          <div className="min-w-0">{priceDisplay("sm")}</div>
          <span className="shrink-0 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 px-1.5 py-1 rounded-md">MOQ {product.moq}</span>
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
