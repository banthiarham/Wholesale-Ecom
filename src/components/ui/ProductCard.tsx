"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, Star, Package, ShoppingCart } from "lucide-react"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"
import { SeasonalDiscount, PaymentOffer, discountBadge, getPaymentOfferBadge } from "@/lib/pricing"
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

  const ratingRow = (starSize: number, textClass: string) =>
    (product.rating ?? 0) > 0 && (
      <>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={starSize} className={s <= Math.round(product.rating!) ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
          ))}
        </div>
        <span className={textClass}>({product.reviewCount ?? product.rating})</span>
      </>
    )

  const stockDot = (isOos: boolean, isLow: boolean) => (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOos ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-green-400"}`} />
  )

  if (view === "list") {
    const listLowStock = !isOutOfStock && (product.inventoryQuantity ?? Infinity) <= Math.max(product.moq * 2, 20)
    return (
      <Link href={`/products/${product.handle}`} className="card-base flex group">
        <div className="relative w-44 sm:w-52 flex-shrink-0 bg-gray-50 overflow-hidden rounded-l-2xl">
          <div className="relative w-full h-full min-h-[160px]">
            {product.thumbnail ? (
              <Image src={product.thumbnail} alt={product.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out" sizes="208px" />
            ) : (
              <div className="w-full h-full min-h-[160px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <Package size={32} className="text-gray-200" />
              </div>
            )}
            {seasonalDiscount && <span className="absolute top-2.5 left-2.5 badge badge-warning shadow-sm">{discountBadge(seasonalDiscount)}</span>}
            {product.tierPrices && product.tierPrices.length > 0 && <span className="absolute top-2.5 right-2.5 badge badge-success shadow-sm">Bulk</span>}
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
            {ratingRow(12, "text-xs text-gray-400")}
            {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
          </div>
          <div className="mt-2.5">{priceDisplay("md")}</div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">{ruleBadge("md")}</div>
          <div className="mt-auto pt-4 flex items-center gap-4 flex-wrap">
            <span className="body-sm">MOQ: <span className="font-semibold text-gray-700">{product.moq}</span></span>
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
    <Link href={`/products/${product.handle}`} className="card-base overflow-hidden group flex flex-col h-full">
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.thumbnail ? (
          <Image src={product.thumbnail} alt={product.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package size={40} className="text-gray-200" />
          </div>
        )}
        {/* Subtle top scrim keeps badges legible over busy photography */}
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/[0.08] to-transparent pointer-events-none" />
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {seasonalDiscount && <span className="badge badge-warning shadow-sm">{discountBadge(seasonalDiscount)}</span>}
          {product.tierPrices && product.tierPrices.length > 0 && <span className="badge badge-success shadow-sm">Bulk</span>}
          {product.tags?.includes("best-seller") && <span className="badge badge-primary shadow-sm">Best Seller</span>}
        </div>
        {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice) && (
          <span className="absolute bottom-2.5 left-2.5 badge badge-danger shadow-sm">Sale</span>
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
        <div className="flex items-center gap-1.5 mt-1.5">{ratingRow(11, "text-[11px] text-gray-400")}
          {product.sku && <span className="text-[11px] text-gray-400">· {product.sku}</span>}
        </div>
        <div className="mt-2">{priceDisplay("sm")}</div>
        <div className="flex flex-wrap gap-1 mt-1.5">{ruleBadge("sm")}</div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold">
          <span className="body-sm !text-[11px]">MOQ: {product.moq}</span>
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
