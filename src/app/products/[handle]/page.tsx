"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, Heart, Star, Truck, Package, ShieldCheck, ChevronRight, ChevronDown, MessageSquare, Flame, Gift, Layers, PlusCircle, AlertTriangle, Minus, Plus, Share2, Check, FileText, X, Store, Sparkles, ChevronLeft, ZoomIn, Tag, Lock, Undo2, Headphones, Receipt } from "lucide-react"
import { formatPrice, getCartSessionId, getContrastTextColor, isExternalImageUrl } from "@/lib/utils"
import { PricingBreakdown, SeasonalDiscount, PaymentOffer, TierPrice, fetchPricing, fetchSeasonalDiscounts, fetchPaymentOffers, getProductDiscount, discountBadge, getPaymentOfferBadge, findApplicableTier, getEffectiveUnitPrice, sortTierPrices } from "@/lib/pricing"
import { useQuantityStepper } from "@/lib/pricing/useQuantityStepper"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import { useGstRates, withGst, gstLabel } from "@/lib/useGstRates"
import { useOfferChoice } from "@/lib/offerChoices"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"
import { BankOfferCard, BankOffersModal } from "@/components/ui/BankOffers"
import VariantSelector, { ProductVariantInfo, VariantOption, pickInitialVariant, variantImages, variantStock } from "@/components/storefront/VariantSelector"
import dynamic from "next/dynamic"

const PackageConfigurator = dynamic(() => import("@/components/storefront/PackageConfigurator"), { ssr: false })

interface Review { id: string; rating: number; title: string | null; body: string | null; user: { firstName: string | null; lastName: string | null } }
interface ProductOfferInfo {
  ruleId: string; name: string; type: string; description: string; summary: string
  condition: string | null; unitsNeeded: number; eligible: boolean; savings: number; validUntil: string | null
}
interface RelatedProduct {
  id: string; title: string; handle: string; thumbnail: string | null; unitPrice: string; compareAtPrice: string | null; moq: number; rating: number; tierPrices: TierPrice[]
}
interface Product {
  id: string; title: string; handle: string; description: string | null; sku: string | null; moq: number;
  unitPrice: number; compareAtPrice: number | null; inventoryQuantity: number; thumbnail: string | null;
  images: string[]; vendorName: string | null; vendorId: string | null; rating: number; reviewCount: number; tags: string[];
  category: { id: string; name: string; handle: string } | null;
  tierPrices: TierPrice[]; reviews: Review[];
  categoryId?: string
  metadata?: Record<string, unknown> | null
  hasVariants?: boolean
  variantOptions?: VariantOption[] | null
  variants?: ProductVariantInfo[]
}

export default function ProductDetailPage() {
  const params = useParams()
  const [baseProduct, setProduct] = useState<Product | null>(null)
  const [variantId, setVariantId] = useState<string | null>(null)
  const selectedVariant = baseProduct?.hasVariants
    ? baseProduct.variants?.find((v) => v.id === variantId && v.isActive) ?? null
    : null
  const product = useMemo<Product | null>(() => {
    if (!baseProduct || !baseProduct.hasVariants) return baseProduct
    if (!selectedVariant) return { ...baseProduct, inventoryQuantity: 0, tierPrices: [] }
    return {
      ...baseProduct,
      unitPrice: Number(selectedVariant.price),
      sku: selectedVariant.sku,
      inventoryQuantity: variantStock(selectedVariant),
      tierPrices: [],
    }
  }, [baseProduct, selectedVariant])
  const selectVariant = (id: string) => {
    setVariantId(id)
    // Only the selected variant's own images are shown; a variant without images uses the product's.
    const v = baseProduct?.variants?.find((x) => x.id === id)
    const own = variantImages(v)
    setMainImage(own[0] || baseProduct?.thumbnail || (baseProduct?.images?.[0] ?? null))
    const url = new URL(window.location.href)
    url.searchParams.set("variant", id)
    window.history.replaceState(null, "", url.toString())
  }
  const [related, setRelated] = useState<RelatedProduct[]>([])
  const [loading, setLoading] = useState(true)
  // Shared stepper (same one Cart/Mini Cart use): defaults to MOQ, steps by exactly 1,
  // and disables the minus button only once quantity has hit the MOQ floor.
  const { qty, increment, decrement, setTyped, flush, atMin } = useQuantityStepper(
    product?.id, product?.moq ?? 1, product?.moq ?? 1, product?.inventoryQuantity ?? 1
  )
  const quantity = qty
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [relatedAddingId, setRelatedAddingId] = useState<string | null>(null)
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState("center")
  const [isZooming, setIsZooming] = useState(false)
  const [inWishlist, setInWishlist] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState("")
  const [reviewBody, setReviewBody] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [userHasReviewed, setUserHasReviewed] = useState(false)
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null)
  const [pricingQty, setPricingQty] = useState<number | null>(null)
  const [pricingProductId, setPricingProductId] = useState<string | null>(null)
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [paymentOffers, setPaymentOffers] = useState<PaymentOffer[]>([])
  const [showOffersModal, setShowOffersModal] = useState(false)
  const [packageData, setPackageData] = useState<any>(null)
  const { user, role } = useAuth()
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

  const rulesProducts = useMemo(
    () => product ? [{ id: product.id, categoryId: product.categoryId || product.category?.id, unitPrice: product.unitPrice }] : [],
    [product?.id, product?.categoryId, product?.category?.id, product?.unitPrice]
  )
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts, extraCharges, shipping, taxes, minimumOrderQuantities, maximumOrderQuantities, customBadges } = useStorefrontRules(rulesProducts, quantity)

  // Related products share the main product's category (loadRelated fetches from
  // `/api/categories/${p.category.handle}`), so the same categoryId applies to all of them.
  // Evaluated separately from the main product so a Related Products badge doesn't depend
  // on the main product's own quantity stepper.
  const relatedRulesProducts = useMemo(
    () => related.map((rp) => ({ id: rp.id, categoryId: product?.categoryId || product?.category?.id, unitPrice: Number(rp.unitPrice) })),
    [related, product?.categoryId, product?.category?.id]
  )
  const { customBadges: relatedCustomBadges } = useStorefrontRules(relatedRulesProducts)

  const { rateFor } = useGstRates()
  const gstRate = rateFor(product?.id, product?.categoryId || product?.category?.id)
  const gst = (n: number) => withGst(n, gstRate)
  // Offers for this product: one applies at a time; the shopper can apply, switch or remove it.
  const [offerChoice, setOfferChoice] = useOfferChoice(product?.id)
  const [offers, setOffers] = useState<ProductOfferInfo[]>([])
  const [appliedOfferId, setAppliedOfferId] = useState<string | null>(null)
  // Units of this product already in the cart (any variant, free items excluded). They count
  // towards an offer's "Buy N" condition together with the quantity chosen on this page.
  const [inCartQty, setInCartQty] = useState(0)
  useEffect(() => {
    if (!product?.id) return
    const productId = product.id
    let cancelled = false
    const load = () => {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      fetch("/api/cart", { headers, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return
          const items: any[] = d.cart?.items || []
          setInCartQty(items.filter((i) => i.productId === productId && i.metadata?.bogo !== true).reduce((sum, i) => sum + (i.quantity || 0), 0))
        })
        .catch(() => {})
    }
    load()
    window.addEventListener("cart-updated", load)
    return () => { cancelled = true; window.removeEventListener("cart-updated", load) }
  }, [product?.id])
  useEffect(() => {
    if (!product?.id) return
    let cancelled = false
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ productId: product.id, quantity: String(quantity) })
      if (inCartQty > 0) qs.set("inCart", String(inCartQty))
      if (offerChoice) qs.set("choice", offerChoice)
      fetch(`/api/rules/product-offers?${qs.toString()}`)
        .then((r) => (r.ok ? r.json() : { offers: [], appliedId: null }))
        .then((d) => {
          if (cancelled) return
          const list: ProductOfferInfo[] = d.offers || []
          setOffers(list)
          setAppliedOfferId(d.appliedId || null)
          // A picked offer whose condition is no longer met is dropped, not kept "selected".
          if (offerChoice && offerChoice !== "none" && !list.some((o) => o.ruleId === offerChoice && o.eligible)) {
            setOfferChoice(null)
          }
        })
        .catch(() => {})
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [product?.id, quantity, offerChoice, inCartQty])
  const ruleDiscount = productDiscounts?.find((d) => d.productId === product?.id) ?? null
  const productBogo = bogo.filter((b) => b.buyProductId === product?.id)
  const productQtyDiscount = quantityDiscounts.find((qd) => qd.productId === product?.id)
  const productCustomBadges = customBadges.filter((b) => b.productId === product?.id)
  const productExtraCharges = extraCharges
  const productShipping = shipping
  const productTaxes = taxes
  const minQtyRule = minimumOrderQuantities.find((m) => m.productId === product?.id)
  const maxQtyRule = maximumOrderQuantities.find((m) => m.productId === product?.id)

  useEffect(() => {
    if (!params.handle) return
    fetch(`/api/products/${params.handle}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) {
          setProduct(data.product)
          const initialVariant = data.product.hasVariants
            ? pickInitialVariant(data.product.variants || [], new URLSearchParams(window.location.search).get("variant"))
            : null
          setVariantId(initialVariant?.id ?? null)
          setMainImage(variantImages(initialVariant)[0] || data.product.thumbnail || (data.product.images?.[0] ?? null))
          loadRelated(data.product)
          checkWishlist(data.product.id)
          checkUserReview(data.product.id)
          fetchPaymentOffers(data.product.id, data.product.categoryId || data.product.category?.id).then(setPaymentOffers)

          const packageTemplateId = data.product.metadata?.packageTemplateId || data.product.metadata?.package_template_id
          if (packageTemplateId) {
            fetch(`/api/packages/${packageTemplateId}/detail`)
              .then((r) => r.json())
              .then((pkgRes) => { if (pkgRes.id || pkgRes.package) setPackageData(pkgRes.id ? pkgRes : pkgRes.package) })
              .catch(() => setPackageData(null))
          }
        }
        setLoading(false)
      })
    fetchSeasonalDiscounts().then(setDiscounts)
  }, [params.handle])

  const checkWishlist = (productId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    fetch("/api/wishlist", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setInWishlist((data.items || []).some((i: any) => i.productId === productId)) })
      .catch(() => {})
  }

  const loadRelated = (p: Product) => {
    if (!p.category) return
    fetch(`/api/categories/${p.category.handle}`)
      .then((res) => res.json())
      .then((data) => { setRelated((data.category?.products || []).filter((rp: any) => rp.id !== p.id).slice(0, 4)) })
      .catch(() => {})
  }

  const handleAddToCart = async () => {
    if (!product) return
    setAdding(true)
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId: product.id, quantity, ...(selectedVariant ? { variantId: selectedVariant.id } : {}), ...(offerChoice ? { offerChoice } : {}) }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("cart-updated"))
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
        openCartDrawer()
      } else {
        showToast("error", data.message || "Could not add to cart")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setAdding(false)
    }
  }

  const handleRelatedAddToCart = async (productId: string, qty: number) => {
    setRelatedAddingId(productId)
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId, quantity: qty }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("cart-updated"))
        openCartDrawer()
      } else {
        showToast("error", data.message || "Could not add to cart")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setRelatedAddingId(null)
    }
  }

  const toggleWishlist = async () => {
    if (!product) return
    const token = localStorage.getItem("token")
    if (!token) { showToast("info", "Please sign in to add items to your wishlist"); return }
    setWishlistLoading(true)
    try {
      if (inWishlist) {
        const res = await fetch(`/api/wishlist/${product.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) setInWishlist(false)
      } else {
        const res = await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ productId: product.id }) })
        if (res.ok) setInWishlist(true)
      }
    } catch (err) { console.error(err) } finally { setWishlistLoading(false) }
  }

  const checkUserReview = (productId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    fetch(`/api/reviews?productId=${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setUserHasReviewed((data.reviews || []).filter((r: any) => r.user?.id).length > 0) })
      .catch(() => {})
  }

  const handleSubmitReview = async () => {
    if (!product || !reviewBody.trim()) return
    const token = localStorage.getItem("token")
    if (!token) return
    setSubmittingReview(true)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, rating: reviewRating, title: reviewTitle, body: reviewBody }),
      })
      if (res.ok) {
        setUserHasReviewed(true)
        setShowReviewForm(false)
        setReviewTitle(""); setReviewBody(""); setReviewRating(5)
        const fresh = await fetch(`/api/products/${product.handle}`).then((r) => r.json())
        if (fresh.product) setProduct(fresh.product)
      } else {
        const data = await res.json()
        showToast("error", data.message || "Failed to submit review")
      }
    } catch (err) { console.error(err) } finally { setSubmittingReview(false) }
  }

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxOpen(false) }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [lightboxOpen])

  // Sole source of role/contract pricing — fires immediately once the product loads
  // (using whatever `quantity` is at that point, i.e. MOQ) and again on every quantity
  // change. Previously this bailed out until `pricing` was already set, but nothing
  // else ever set it first except a stale, hardcoded quantity=1 fetch — so the default
  // MOQ quantity displayed a price computed for quantity 1 until the user touched the stepper.
  useEffect(() => {
    if (!product) return
    const token = localStorage.getItem("token")
    if (!token) { setPricing(null); setPricingQty(null); setPricingProductId(null); return }
    const userId = JSON.parse(atob(token.split(".")[1]))?.userId || JSON.parse(atob(token.split(".")[1]))?.sub
    if (!userId) { setPricing(null); setPricingQty(null); setPricingProductId(null); return }
    let cancelled = false
    fetchPricing(product.id, quantity, userId, selectedVariant?.id).then((result) => {
      if (cancelled) return
      setPricing(result)
      setPricingQty(quantity)
      setPricingProductId(`${product.id}:${selectedVariant?.id ?? ""}`)
    })
    return () => { cancelled = true }
  }, [quantity, product?.id, selectedVariant?.id])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>
  if (!product) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"><Package size={48} className="text-gray-300 mb-4" /><h1 className="heading-lg mb-2">Product not found</h1><p className="body-sm mb-4">This product may have been removed or is unavailable.</p><Link href="/products" className="btn-primary">Browse Products</Link></div>

  const isProductHidden = hiddenProductIds.has(product.id)
  const isPriceHidden = hiddenPriceProductIds.has(product.id)
  const isNonPurchasable = nonPurchasableProducts.has(product.id)
  const nonPurchasableMsg = nonPurchasableProducts.get(product.id) || ""

  if (isProductHidden) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Package size={48} className="text-gray-300 mb-4" />
        <h1 className="heading-lg mb-2">Product Not Available</h1>
        <p className="body-sm mb-4">This product is not available for your account.</p>
        <Link href="/products" className="btn-primary">Browse Products</Link>
      </div>
    )
  }

  // `pricing` is only trustworthy once it was fetched for the CURRENT quantity — while a
  // fresh fetch is in flight after a quantity change, fall back to the instantly-computed
  // (client-side) tier price so the displayed price and tier always update immediately,
  // never showing a stale role/contract price left over from the previous quantity.
  const pricingKey = `${product.id}:${selectedVariant?.id ?? ""}`
  const pricingIsCurrent = pricing != null && pricingQty === quantity && pricingProductId === pricingKey

  // If the logged-in buyer's role has its own quantity tiers for this product (Admin ->
  // Role-Based Pricing), show those in "Buy More, Save More" instead of the generic
  // product-wide tier ladder — reuses the same tier-math helpers so the ladder can never
  // disagree with the actually-charged price. Falls back to the universal product tier
  // ladder when the buyer isn't logged in or their role has no tiers for this product.
  const roleTierPrices: TierPrice[] =
    pricingProductId === pricingKey && pricing?.roleTiers && pricing.roleTiers.length > 0
      ? pricing.roleTiers.map((rt) => ({ minQty: rt.minQty, maxQty: null, price: rt.price }))
      : []
  const displayTierPrices = roleTierPrices.length > 0 ? roleTierPrices : product.tierPrices

  const effectivePrice = getEffectiveUnitPrice(displayTierPrices, quantity, product.unitPrice)
  const activeTier = findApplicableTier(displayTierPrices, quantity)
  const discountPercent = product.compareAtPrice && effectivePrice < Number(product.compareAtPrice)
    ? Math.round(((Number(product.compareAtPrice) - effectivePrice) / Number(product.compareAtPrice)) * 100) : 0

  // The backend's finalPrice already reflects the full priority waterfall
  // (Contract > Role Custom [now itself quantity-tiered] > Tier > Discount > Base) — trust
  // it directly once current, including for the calculator's Total/Savings figures so they
  // never disagree with the Price/unit figure shown right above them.
  const displayPrice = pricingIsCurrent ? pricing!.finalPrice : effectivePrice
  const totalCost = displayPrice * quantity
  const savingsPerUnit = Number(product.unitPrice) - displayPrice
  const totalSavings = savingsPerUnit * quantity
  const priceLabel = pricingIsCurrent && pricing!.appliedRule === "contract" ? "Contract" : pricingIsCurrent && pricing!.appliedRule === "role" ? pricing!.appliedRoleName : null

  // A buyer whose role has a wholesale price for this product always sees that price in the
  // headline, with its min quantity underneath — even while `quantity` is below the minimum.
  // (displayPrice above stays the price actually charged: retail until the minimum is reached.)
  const roleHeadline =
    pricingProductId === pricingKey && pricing?.roleDisplayPrice != null && pricing.appliedRule !== "contract"
      ? pricing
      : null
  // A contract price the buyer has not reached the minimum quantity for is still the price they are shown.
  const contractHeadline =
    pricingProductId === pricingKey && pricing?.contractDisplayPrice != null && pricing.appliedRule !== "contract" ? pricing : null
  const headlinePrice = contractHeadline ? contractHeadline.contractDisplayPrice! : roleHeadline ? roleHeadline.roleDisplayPrice! : displayPrice
  const headlineLabel = contractHeadline ? "Contract" : roleHeadline ? roleHeadline.appliedRoleName : priceLabel
  const roleBelowMin = !!roleHeadline && roleHeadline.roleQtyReached === false

  if (pricingIsCurrent) {
    console.log("[PricingEngine:ProductDetails]", {
      productId: product?.id,
      quantity,
      loggedInRole: pricing!.appliedRoleName,
      basePrice: pricing!.basePrice,
      rolePrice: pricing!.rolePrice,
      tierPrice: pricing!.tierPrice,
      finalPrice: pricing!.finalPrice,
      appliedRule: pricing!.appliedRule,
    })
  }

  const productJsonLd = product ? {
    "@context": "https://schema.org", "@type": "Product", name: product.title,
    description: product.description || `${product.title} — wholesale pricing from MOQ ${product.moq}`,
    image: product.thumbnail || (product.images?.[0] ?? undefined), sku: product.sku || undefined,
    brand: product.vendorName ? { "@type": "Brand", name: product.vendorName } : undefined,
    offers: { "@type": "Offer", priceCurrency: "INR", price: product.unitPrice, availability: product.inventoryQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://wholesalecenter.in"}/products/${product.handle}` },
    aggregateRating: product.reviewCount > 0 ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } : undefined,
  } : null

  const effectiveMinQty = minQtyRule ? Math.max(product.moq, minQtyRule.minQty) : product.moq
  const effectiveMaxQty = maxQtyRule ? Math.min(product.inventoryQuantity, maxQtyRule.maxQty) : product.inventoryQuantity

  // Collect all offer/rule sections for collapsible area
  const hasOffers = productBogo.length > 0 || productQtyDiscount || productExtraCharges.length > 0 || productShipping || productTaxes.length > 0 || (minQtyRule || maxQtyRule)
  const hasPricingInfo = (pricingIsCurrent && (pricing!.rolePrice !== null || pricing!.contractPrice !== null || pricing!.seasonalDiscount > 0)) || ruleDiscount

  // ── Product page layout helpers ──
  // A variant with its own images shows only those; otherwise the product's gallery is used.
  const ownVariantImages = variantImages(selectedVariant)
  const galleryImages = ownVariantImages.length > 0
    ? Array.from(new Set(ownVariantImages))
    : Array.from(new Set([product.thumbnail, ...(product.images || [])].filter((u): u is string => !!u)))
  const stepImage = (dir: number) => {
    if (galleryImages.length < 2) return
    const i = Math.max(0, galleryImages.indexOf(mainImage || ""))
    setMainImage(galleryImages[(i + dir + galleryImages.length) % galleryImages.length])
  }
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) { await (navigator as any).share({ title: product.title, url }); return }
      await navigator.clipboard.writeText(url)
      showToast("success", "Product link copied")
    } catch { /* user dismissed the share sheet */ }
  }

  const isOutOfStock = product.inventoryQuantity <= 0
  const isLowStock = !isOutOfStock && product.inventoryQuantity <= Math.max(product.moq * 2, 20)
  const shownPrice = Number(ruleDiscount ? product.unitPrice - ruleDiscount.discountAmount : headlinePrice)
  const strikeCandidate = product.compareAtPrice != null && Number(product.compareAtPrice) > shownPrice ? Number(product.compareAtPrice) : Number(product.unitPrice) > shownPrice ? Number(product.unitPrice) : null
  const strikePrice = strikeCandidate
  const shownDiscountPct = strikePrice ? Math.round(((strikePrice - shownPrice) / strikePrice) * 100) : 0

  const metaSpecs: [string, string][] = product.metadata && typeof product.metadata === "object"
    ? Object.entries(product.metadata).filter(([k, v]) => !/packageTemplate|package_template/i.test(k) && (typeof v === "string" || typeof v === "number")).map(([k, v]) => [k.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()), String(v)])
    : []
  const detailRows: { icon: any; label: string; value: React.ReactNode }[] = [
    ...(product.category ? [{ icon: Layers, label: "Category", value: <Link href={`/categories/${product.category.handle}`} className="hover:text-primary-600 hover:underline">{product.category.name}</Link> }] : []),
    { icon: Package, label: "Min. Order Qty", value: `${roleHeadline?.roleMinQty ?? product.moq} units` },
    { icon: Truck, label: "Availability", value: <span className={isOutOfStock ? "text-red-600" : "text-green-600"}>{isOutOfStock ? "Out of stock" : `${product.inventoryQuantity} units in stock`}</span> },
    ...(gstRate > 0 ? [{ icon: Receipt, label: "GST", value: <>{Number(gstRate.toFixed(2))}% <span className="font-normal text-gray-500">(Included in price)</span></> }] : []),
    ...metaSpecs.map(([label, value]) => ({ icon: ShieldCheck, label, value })),
  ]
  const detailsTable = (
    <div className="flex flex-col rounded-lg border border-gray-100 overflow-hidden divide-y divide-gray-100 text-[13px]">
      {detailRows.map((r) => (
        <div key={r.label} className="flex items-center gap-2.5 px-3 py-1.5 odd:bg-gray-50/70">
          <r.icon size={14} className="text-gray-400 shrink-0" />
          <span className="w-28 sm:w-32 shrink-0 text-gray-600">{r.label}</span>
          <span className="min-w-0 flex-1 text-gray-800 font-medium break-words">{r.value}</span>
        </div>
      ))}
    </div>
  )
  const trustItems = [
    { icon: Truck, title: "Fast Delivery", sub: "Across India", tint: "bg-blue-50 text-blue-600" },
    { icon: ShieldCheck, title: "Verified Products", sub: "100% Genuine", tint: "bg-green-50 text-green-600" },
    { icon: Lock, title: "Secure Payments", sub: "Multiple payment options", tint: "bg-purple-50 text-purple-600" },
    { icon: Undo2, title: "Easy Returns", sub: "Hassle-free returns", tint: "bg-sky-50 text-sky-600" },
    { icon: Headphones, title: "Dedicated Support", sub: "24/7 assistance", tint: "bg-emerald-50 text-emerald-600" },
  ]

  return (
    <>
      {productJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />}
      <div className="min-h-screen bg-gray-50/50">
        <main className="section-container py-3 sm:py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
            <Link href="/" className="hover:text-primary-600 transition-colors shrink-0">Home</Link>
            <ChevronRight size={14} className="shrink-0" />
            <Link href="/products" className="hover:text-primary-600 transition-colors shrink-0">Products</Link>
            {product.category && (<><ChevronRight size={14} className="shrink-0" /><Link href={`/categories/${product.category.handle}`} className="hover:text-primary-600 transition-colors shrink-0">{product.category.name}</Link></>)}
            <ChevronRight size={14} className="shrink-0" />
            <span className="text-gray-900 font-medium truncate">{product.title}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3.6fr)] gap-3 items-stretch">
                {/* Gallery */}
                <div className="card-base-static p-2.5 min-w-0 flex flex-col lg:self-start lg:sticky lg:top-40">
                  <div className="relative rounded-xl bg-gray-50 border border-gray-100 overflow-hidden aspect-[4/3]">
                    <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-1.5rem)]">
                                            {productCustomBadges[0] && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm max-w-full truncate"
                          style={{ backgroundColor: productCustomBadges[0].badgeColor || "#7c3aed", color: getContrastTextColor(productCustomBadges[0].badgeColor || "#7c3aed") }}
                          title={productCustomBadges[0].badgeLabel}
                        >
                          <Sparkles size={12} className="shrink-0" />
                          <span className="truncate">{productCustomBadges[0].badgeLabel}</span>
                        </span>
                      )}
                    </div>
                    {mainImage ? (
                      <div
                        className="absolute inset-0 overflow-hidden cursor-zoom-in"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setZoomOrigin(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`)
                        }}
                        onMouseEnter={() => setIsZooming(true)}
                        onMouseLeave={() => setIsZooming(false)}
                        onClick={() => setLightboxOpen(true)}
                      >
                        <Image
                          src={mainImage}
                          alt={product.title}
                          fill
                          unoptimized={isExternalImageUrl(mainImage)}
                          className={`object-contain p-3 transition-transform duration-200 ease-out ${isZooming ? "md:scale-[1.8]" : "scale-100"}`}
                          style={{ transformOrigin: zoomOrigin }}
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 30vw"
                          priority
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package size={48} className="text-gray-200" />
                      </div>
                    )}
                    {galleryImages.length > 1 && (
                      <>
                        <button type="button" onClick={() => stepImage(-1)} aria-label="Previous image" className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition"><ChevronLeft size={16} /></button>
                        <button type="button" onClick={() => stepImage(1)} aria-label="Next image" className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition"><ChevronRight size={16} /></button>
                      </>
                    )}
                    {mainImage && (
                      <button type="button" onClick={() => setLightboxOpen(true)} aria-label="Zoom image" className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition"><ZoomIn size={17} /></button>
                    )}
                  </div>
                  {galleryImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pt-2.5 pb-0.5 [scrollbar-width:thin]">
                      {galleryImages.map((img, idx) => (
                        <button key={idx} type="button" onClick={() => setMainImage(img)} aria-label={`Show image ${idx + 1}`} className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 bg-white overflow-hidden transition-all duration-200 ${mainImage === img ? "border-primary-600 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
                          <Image src={img} alt={`${product.title} ${idx + 1}`} width={80} height={80} unoptimized={isExternalImageUrl(img)} className="w-full h-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex flex-col gap-3">
                {/* Product info */}
                <div className="card-base-static p-3.5 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug tracking-tight">{product.title}</h1>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={toggleWishlist} disabled={wishlistLoading} aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"} className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${inWishlist ? "border-red-200 bg-red-50 text-red-500" : "border-gray-200 text-gray-500 hover:text-red-500 hover:bg-gray-50"}`}>
                        <Heart size={15} fill={inWishlist ? "currentColor" : "none"} />
                      </button>
                      <button type="button" onClick={handleShare} aria-label="Share" className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition"><Share2 size={15} /></button>
                    </div>
                  </div>
                  {(product.sku || product.vendorName) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {product.sku && <>SKU: {product.sku}</>}
                      {product.sku && product.vendorName && <span className="mx-2 text-gray-300">|</span>}
                      {product.vendorName && <>Seller: {product.vendorId
                        ? <Link href={`/vendors/${product.vendorId}`} className="font-semibold text-primary-600 hover:underline">{product.vendorName}</Link>
                        : <span className="font-semibold text-primary-600">{product.vendorName}</span>}</>}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill={i <= Math.round(product.rating) ? "currentColor" : "none"} className={i <= Math.round(product.rating) ? "text-amber-400" : "text-gray-300"} />)}</div>
                    {product.reviewCount > 0 && <span className="text-xs font-bold text-gray-900">{Number(product.rating).toFixed(1)}</span>}
                    <span className="text-xs text-gray-500">({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold ${isOutOfStock ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? "bg-red-500" : "bg-green-500"}`} />
                      {isOutOfStock ? "Out of Stock" : "In Stock"}
                    </span>
                    {!isOutOfStock && <span className="text-gray-500">{product.inventoryQuantity} units available</span>}
                    {isLowStock && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Only {product.inventoryQuantity} left</span>}
                  </div>
                  {product.hasVariants && product.variantOptions && product.variants && (
                    <div className="mt-3">
                      {product.variants.some((v) => v.isActive) ? (
                        <VariantSelector options={product.variantOptions} variants={product.variants} selectedId={selectedVariant?.id ?? null} onSelect={selectVariant} />
                      ) : (
                        <p className="text-xs font-medium text-red-600">This product is currently unavailable.</p>
                      )}
                    </div>
                  )}
                  {product.description && (
                    <p className="text-gray-600 leading-relaxed mt-2.5 line-clamp-3 whitespace-pre-line text-[13px]">{product.description}</p>
                  )}
                  <div className="mt-3">{detailsTable}</div>
                </div>
            {/* Available Offers */}
                <div className="card-base-static p-3.5 min-w-0 flex-1 flex flex-col">
              <h2 className="text-base font-bold text-gray-900">Available Offers</h2>
              <span className="block mt-1 mb-2.5 h-0.5 w-8 rounded bg-primary-600" />
              <div className="flex-1 flex flex-col gap-2.5">
                {offers.map((o) => {
                  const applied = o.ruleId === appliedOfferId
                  // Applying an offer also meets its condition: the quantity is raised to the offer's minimum.
                  const targetQty = o.eligible ? quantity : quantity + o.unitsNeeded
                  const canApply = targetQty <= effectiveMaxQty
                  return (
                    <div key={o.ruleId} className={`rounded-lg border p-3 transition-colors ${applied ? "border-primary-300 bg-primary-50/60" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tag size={14} className={applied ? "text-primary-600" : "text-gray-400"} />
                            <p className="text-sm font-semibold text-gray-900">{o.name}</p>
                            {applied && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-green-100 text-green-700 px-2 py-0.5">Applied</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{o.description}</p>
                          <p className="text-[11px] mt-1.5 text-gray-500">
                            {o.condition
                              ? o.eligible
                                ? <span className="text-green-700">{o.condition} · condition met</span>
                                : <span className="text-amber-700">{o.condition} · applying sets quantity to {targetQty}</span>
                              : "No conditions"}
                            {o.validUntil && <span> · Valid till {new Date(o.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                          </p>
                        </div>
                        {applied ? (
                          <button type="button" onClick={() => setOfferChoice("none")} className="shrink-0 text-xs font-semibold rounded-md border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 transition">
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canApply}
                            title={canApply ? undefined : "Not enough stock to meet this offer's condition"}
                            onClick={() => {
                              if (!o.eligible && o.unitsNeeded > 0) { setTyped(targetQty); flush() }
                              setOfferChoice(o.ruleId)
                            }}
                            className="shrink-0 text-xs font-semibold rounded-md bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            {appliedOfferId ? "Switch" : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {paymentOffers.length > 0 && !isPriceHidden && (
                  <div className="space-y-2">
                    {offers.length > 0 && <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 pt-1">Bank &amp; payment offers</h3>}
                    {paymentOffers.slice(0, 3).map((offer) => (
                      <BankOfferCard key={offer.id} offer={offer} />
                    ))}
                    {paymentOffers.length > 3 && (
                      <button onClick={() => setShowOffersModal(true)} className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                        View all {paymentOffers.length} offers
                      </button>
                    )}
                  </div>
                )}
                {offers.length === 0 && !(paymentOffers.length > 0 && !isPriceHidden) && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-5">
                    <Tag size={20} className="text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">No offers available on this product right now</p>
                    <p className="text-xs text-gray-400">Check back soon for new offers.</p>
                  </div>
                )}
              </div>
            </div>

                </div>

            {/* Right column: price + bulk pricing */}
            <div className="md:col-span-2 lg:col-span-1 flex flex-col gap-3 min-w-0 lg:self-start lg:sticky lg:top-40">
              <div className="card-base-static p-3.5 space-y-2.5">
                {/* Price */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {isPriceHidden ? (
                      <span className="text-base text-gray-500 italic">Contact us for pricing</span>
                    ) : (
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <span className="text-2xl font-extrabold text-primary-700 tracking-tight">{formatPrice(gst(shownPrice))}</span>
                        {strikePrice != null && <span className="text-sm text-gray-400 line-through">{formatPrice(gst(strikePrice))}</span>}
                      </div>
                    )}
                    {!isPriceHidden && gstRate > 0 && <p className="text-xs text-gray-500 mt-0.5">{gstLabel(gstRate)}</p>}
                    {!isPriceHidden && headlineLabel && (
                      <span className="inline-block mt-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ backgroundColor: role?.color || "#7c3aed", color: getContrastTextColor(role?.color || "#7c3aed") }}>{headlineLabel} Price</span>
                    )}
                  </div>
                  {!isPriceHidden && shownDiscountPct > 0 && <span className="chip-sale shrink-0">{shownDiscountPct}% OFF</span>}
                </div>

                {!isPriceHidden && contractHeadline?.contractMinQty != null && contractHeadline.contractMinQty > 1 && (
                  <p className="-mt-2 text-xs text-gray-500">Contract price applies from {contractHeadline.contractMinQty} units</p>
                )}

                {!isPriceHidden && roleHeadline?.roleMinQty != null && !contractHeadline && (
                  <div className="-mt-2">
                    <p className="text-xs text-gray-500">Min quantity - {roleHeadline.roleMinQty}</p>
                    {roleBelowMin && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Below {roleHeadline.roleMinQty} units you are charged the retail price of {formatPrice(gst(Number(product.unitPrice)))}/unit.
                      </p>
                    )}
                  </div>
                )}

                {/* Price warnings */}
                {isNonPurchasable && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <span className="text-sm text-red-700 font-medium">{nonPurchasableMsg || "This product is not available for purchase"}</span>
                  </div>
                )}
                {ruleDiscount && !isPriceHidden && savingsPerUnit === 0 && (
                  <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <span className="text-sm text-green-700 font-medium">{ruleDiscount.ruleName}: {Number(ruleDiscount.discountPercent.toFixed(1))}% off — save {formatPrice(gst(ruleDiscount.discountAmount))}/unit</span>
                  </div>
                )}

                {/* Package Configurator or Add to Cart */}
                {packageData ? (
                  <PackageConfigurator pkg={packageData} userId={user?.id} />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={decrement}
                          disabled={atMin}
                          title={atMin ? `Minimum order quantity is ${product.moq}` : undefined}
                          className="px-2.5 py-2 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        ><Minus size={14} /></button>
                        <input
                          type="number" min={effectiveMinQty} max={effectiveMaxQty} value={quantity}
                          onChange={(e) => setTyped(Number(e.target.value))}
                          onBlur={flush}
                          onKeyDown={(e) => { if (e.key === "Enter") flush() }}
                          className="w-12 text-center border-x border-gray-200 py-2 text-sm font-medium focus:outline-none"
                        />
                        <button onClick={increment} className="px-2.5 py-2 hover:bg-gray-50 transition-colors"><Plus size={14} /></button>
                      </div>
                      <button onClick={handleAddToCart} disabled={adding || (!!product.hasVariants && !selectedVariant) || product.inventoryQuantity <= 0 || quantity < effectiveMinQty || quantity > effectiveMaxQty || isNonPurchasable} className="flex-1 min-w-0 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {added ? <><Check size={16} /> Added!</> : adding ? "Adding..." : product.hasVariants && !selectedVariant ? "Select Options" : product.hasVariants && product.inventoryQuantity <= 0 ? "Out of Stock" : isNonPurchasable ? (nonPurchasableMsg || "Not Available") : quantity < effectiveMinQty ? "Adjust Quantity" : <><ShoppingCart size={16} /> Add to Cart</>}
                      </button>
                    </div>
                    {quantity < effectiveMinQty && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 -mt-2">
                        <AlertTriangle size={12} /> Minimum order quantity is {effectiveMinQty} units — quantity can't go lower.
                      </p>
                    )}
                  </>
                )}


                {!packageData && !isNonPurchasable && (
                  <Link
                    href={`/rfqs/new?productId=${product.id}&quantity=${quantity}`}
                    className="flex items-center justify-center gap-2 h-9 rounded-lg border border-primary-200 bg-primary-50/60 text-primary-700 hover:bg-primary-50 hover:border-primary-300 transition-all text-[13px] font-bold"
                  >
                    <FileText size={15} /> Add to Quotation
                  </Link>
                )}

                {/* Rule badges */}
                <ProductRuleBadge
                  priceHidden={isPriceHidden}
                  nonPurchasable={isNonPurchasable}
                  nonPurchasableMessage={nonPurchasableMsg}
                  hasRolePrice={pricingIsCurrent && (pricing!.appliedRule === "role" || pricing!.appliedRule === "contract")}
                  roleLabel={pricing?.appliedRoleName || undefined}
                  bogoLabel={productBogo.length > 0 ? `Buy ${productBogo[0].buyQuantity} Get ${productBogo[0].freeQuantity} Free` : undefined}
                  quantityDiscountLabel={productQtyDiscount ? productQtyDiscount.ruleName : undefined}
                  discountLabel={ruleDiscount?.ruleName}
                  discountPercent={ruleDiscount?.discountPercent}
                />
              </div>

              {/* Bulk quantity pricing — always rendered so the column keeps the same shape */}
              {!isPriceHidden && !packageData && (() => {
                const hasTiers = displayTierPrices.length > 0
                const sortedTiers = hasTiers
                  ? sortTierPrices(displayTierPrices)
                  : [{ id: "base", minQty: effectiveMinQty, maxQty: null, price: displayPrice } as TierPrice]
                return (
                  <div className="card-base-static p-3.5 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Layers size={16} className="text-gray-500" /> Bulk Quantity Pricing</h2>
                      <span className="text-xs font-semibold text-gray-500">Per Unit</span>
                    </div>
                    {roleTierPrices.length > 0 && (
                      <p className="text-xs text-primary-600 font-medium mb-2 flex items-center gap-1.5">
                        <Layers size={12} /> Special pricing for your account{priceLabel ? ` (${priceLabel})` : ""}
                      </p>
                    )}
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-1 space-y-0.5">
                      {sortedTiers.map((tp, idx) => {
                        const isActive = hasTiers ? tp === activeTier : true
                        return (
                          <div key={tp.id ?? `${tp.minQty}-${idx}`} className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${isActive ? "bg-primary-600 text-white font-bold shadow-sm" : "bg-white text-gray-700"}`}>
                            <span>{tp.minQty}{tp.maxQty ? ` - ${tp.maxQty}` : "+"} units</span>
                            <span className="font-bold">{formatPrice(gst(Number(tp.price)))}</span>
                          </div>
                        )
                      })}
                    </div>
                    {!hasTiers && <p className="mt-2 text-xs text-gray-400">No bulk discounts on this product — same price at any quantity.</p>}
                    <div className="mt-3">
                      <div className="border-t border-gray-100 pt-2.5 space-y-1.5 text-[13px]">
                        {gstRate > 0 && (
                          <>
                            <div className="flex items-center justify-between gap-2 text-gray-500">
                              <span>{quantity} × {formatPrice(displayPrice)} (excl. GST)</span>
                              <span className="text-gray-700">{formatPrice(totalCost)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-gray-500">
                              <span>GST ({Number(gstRate.toFixed(2))}%)</span>
                              <span className="text-gray-700">{formatPrice(gst(totalCost) - totalCost)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100">
                          <span className="font-semibold text-gray-700">Total for {quantity} units{gstRate > 0 ? " (incl. GST)" : ""}</span>
                          <span className="text-base font-bold text-primary-700">{formatPrice(gst(totalCost))}</span>
                        </div>
                        {totalSavings > 0 && <p className="text-xs font-semibold text-green-600 text-right">You save {formatPrice(gst(totalSavings))}</p>}
                      </div>
                    </div>
                  </div>
                )
              })()}

            </div>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-3 mt-3">
            {trustItems.map((t) => (
              <div key={t.title} className="card-base-static flex items-center gap-3 p-3">
                <span className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${t.tint}`}><t.icon size={18} /></span>
                <div className="min-w-0"><p className="text-[13px] font-bold text-gray-900">{t.title}</p><p className="text-[11px] text-gray-500">{t.sub}</p></div>
              </div>
            ))}
          </div>

          {/* Description | Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3 items-stretch">
            <div className="card-base-static p-3.5 min-w-0 h-full flex flex-col">
              <h2 className="text-base font-bold text-gray-900">Description</h2>
              <span className="block mt-1 mb-2.5 h-0.5 w-8 rounded bg-primary-600" />
              {product.description ? (
                <p className="text-gray-600 whitespace-pre-line leading-relaxed text-[13px]">{product.description}</p>
              ) : (
                <p className="text-gray-400 text-sm">No description provided.</p>
              )}
              {/* Specifications — real product data, keeps this card as full as the Reviews card */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Specifications</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                  {[
                    ...(product.sku ? [["SKU", product.sku] as [string, string]] : []),
                    ...(product.category ? [["Category", product.category.name] as [string, string]] : []),
                    ...(product.vendorName ? [["Seller", product.vendorName] as [string, string]] : []),
                    ["Min. order quantity", `${roleHeadline?.roleMinQty ?? product.moq} units`] as [string, string],
                    ["Stock", isOutOfStock ? "Out of stock" : `${product.inventoryQuantity} units`] as [string, string],
                    ...(gstRate > 0 ? [["GST", `${Number(gstRate.toFixed(2))}% (included in price)`] as [string, string]] : []),
                    ...metaSpecs,
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-gray-50 pb-1.5">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="font-medium text-gray-800 text-right break-words min-w-0">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-gray-100">{product.tags.map((tag) => <span key={tag} className="badge bg-gray-100 text-gray-600">{tag}</span>)}</div>
              )}
            </div>

              {/* Reviews */}
              <div className="card-base-static p-3.5 h-full min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div><h2 className="heading-sm">Reviews ({product.reviewCount})</h2><span className="block mt-1.5 h-0.5 w-10 rounded bg-primary-600" /></div>
                  {!userHasReviewed && localStorage.getItem("token") && !showReviewForm && (
                    <button onClick={() => setShowReviewForm(true)} className="btn-sm btn-primary flex items-center gap-1.5">
                      <MessageSquare size={14} /> Write Review
                    </button>
                  )}
                  {userHasReviewed && <span className="badge badge-success">Reviewed</span>}
                </div>

                {showReviewForm && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                    <h3 className="font-semibold text-gray-900 mb-4">Write Your Review</h3>
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                      <div>
                        <label className="body-sm font-medium text-gray-700 mb-2 block">Rating</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button key={val} onClick={() => setReviewRating(val)} className="focus:outline-none">
                              <Star size={28} fill={val <= reviewRating ? "currentColor" : "none"} className={val <= reviewRating ? "text-amber-400" : "text-gray-300"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="body-sm font-medium text-gray-700 mb-1 block">Title (optional)</label>
                        <input type="text" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Summarize your experience" className="input-base" />
                      </div>
                      <div>
                        <label className="body-sm font-medium text-gray-700 mb-1 block">Your Review *</label>
                        <textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} rows={4} placeholder="Share your experience..." className="input-base" />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleSubmitReview} disabled={submittingReview || !reviewBody.trim()} className="btn-primary">
                          {submittingReview ? "Submitting..." : "Submit Review"}
                        </button>
                        <button onClick={() => setShowReviewForm(false)} className="btn-outline">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {product.reviews.length > 0 ? (
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {product.reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill={i <= review.rating ? "currentColor" : "none"} className={i <= review.rating ? "text-amber-400" : "text-gray-200"} />)}</div>
                          <span className="text-sm font-medium text-gray-900">{review.user.firstName || "Anonymous"} {review.user.lastName || ""}</span>
                        </div>
                        {review.title && <h4 className="font-semibold text-sm text-gray-900 mt-1">{review.title}</h4>}
                        {review.body && <p className="text-gray-600 text-[13px] mt-1 leading-relaxed">{review.body}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                    <MessageSquare size={36} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400">No reviews yet. Be the first to review!</p>
                  </div>
                )}
              </div>
          </div>

          {/* Related Products */}
          {related.length > 0 && (
            <div className="mt-12">
              <div className="section-header">
                <h2 className="heading-lg">Related Products</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {related.map((rp) => (
                  <ProductCard
                    key={rp.id}
                    product={rp}
                    view="grid"
                    customBadges={relatedCustomBadges}
                    isAdding={relatedAddingId === rp.id}
                    onAddToCart={handleRelatedAddToCart}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      {showOffersModal && <BankOffersModal offers={paymentOffers} onClose={() => setShowOffersModal(false)} />}
      {lightboxOpen && mainImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10 animate-scale-in"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="relative w-full h-full max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <Image src={mainImage} alt={product.title} fill unoptimized={isExternalImageUrl(mainImage)} className="object-contain" sizes="90vw" />
          </div>
        </div>
      )}
    </>
  )
}
