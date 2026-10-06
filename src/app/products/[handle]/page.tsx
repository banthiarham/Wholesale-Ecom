"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, Heart, Star, Truck, Package, ShieldCheck, ChevronRight, ChevronDown, MessageSquare, Flame, Gift, Layers, PlusCircle, AlertTriangle, Minus, Plus, Share2, Check, FileText, X, Store, Sparkles, ChevronLeft, ZoomIn, Tag, Lock, Undo2, Headphones } from "lucide-react"
import { formatPrice, getCartSessionId, getContrastTextColor, isExternalImageUrl } from "@/lib/utils"
import { PricingBreakdown, SeasonalDiscount, PaymentOffer, TierPrice, fetchPricing, fetchSeasonalDiscounts, fetchPaymentOffers, getProductDiscount, discountBadge, getPaymentOfferBadge, findApplicableTier, getEffectiveUnitPrice, sortTierPrices } from "@/lib/pricing"
import { useQuantityStepper } from "@/lib/pricing/useQuantityStepper"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"
import { BankOfferCard, BankOffersModal } from "@/components/ui/BankOffers"
import dynamic from "next/dynamic"

const PackageConfigurator = dynamic(() => import("@/components/storefront/PackageConfigurator"), { ssr: false })

interface Review { id: string; rating: number; title: string | null; body: string | null; user: { firstName: string | null; lastName: string | null } }
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
}

/* Collapsible section helper */
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon?: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card-base-static overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={18} className="text-gray-400" />}
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        <ChevronRight size={18} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
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
          setMainImage(data.product.thumbnail || (data.product.images?.[0] ?? null))
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
      const res = await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId: product.id, quantity }) })
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
    fetchPricing(product.id, quantity, userId).then((result) => {
      if (cancelled) return
      setPricing(result)
      setPricingQty(quantity)
      setPricingProductId(product.id)
    })
    return () => { cancelled = true }
  }, [quantity, product?.id])

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
  const pricingIsCurrent = pricing != null && pricingQty === quantity

  // If the logged-in buyer's role has its own quantity tiers for this product (Admin ->
  // Role-Based Pricing), show those in "Buy More, Save More" instead of the generic
  // product-wide tier ladder — reuses the same tier-math helpers so the ladder can never
  // disagree with the actually-charged price. Falls back to the universal product tier
  // ladder when the buyer isn't logged in or their role has no tiers for this product.
  const roleTierPrices: TierPrice[] =
    pricingProductId === product.id && pricing?.roleTiers && pricing.roleTiers.length > 0
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
  const priceLabel = pricingIsCurrent && (pricing!.appliedRule === "role" || pricing!.appliedRule === "contract") ? pricing!.appliedRoleName : null

  // A buyer whose role has a wholesale price for this product always sees that price in the
  // headline, with its min quantity underneath — even while `quantity` is below the minimum.
  // (displayPrice above stays the price actually charged: retail until the minimum is reached.)
  const roleHeadline =
    pricingProductId === product.id && pricing?.roleDisplayPrice != null && pricing.appliedRule !== "contract"
      ? pricing
      : null
  const headlinePrice = roleHeadline ? roleHeadline.roleDisplayPrice! : displayPrice
  const headlineLabel = roleHeadline ? roleHeadline.appliedRoleName : priceLabel
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
  const galleryImages = Array.from(new Set([product.thumbnail, ...(product.images || [])].filter((u): u is string => !!u)))
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
    ...(product.vendorName ? [{ icon: Store, label: "Seller", value: product.vendorId ? <Link href={`/vendors/${product.vendorId}`} className="hover:text-primary-600 hover:underline">{product.vendorName}</Link> : product.vendorName }] : []),
    ...(product.category ? [{ icon: Layers, label: "Category", value: <Link href={`/categories/${product.category.handle}`} className="hover:text-primary-600 hover:underline">{product.category.name}</Link> }] : []),
    { icon: Package, label: "Min. Order Qty", value: `${roleHeadline?.roleMinQty ?? product.moq} units` },
    { icon: Truck, label: "Availability", value: <span className={isOutOfStock ? "text-red-600" : "text-green-600"}>{isOutOfStock ? "Out of stock" : `${product.inventoryQuantity} units in stock`}</span> },
    ...metaSpecs.map(([label, value]) => ({ icon: ShieldCheck, label, value })),
  ]
  const detailsTable = (
    <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100 text-sm">
      {detailRows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 px-3.5 py-2 odd:bg-gray-50/70">
          <r.icon size={16} className="text-gray-400 shrink-0" />
          <span className="w-28 sm:w-36 shrink-0 text-gray-600">{r.label}</span>
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
        <main className="section-container py-4 sm:py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
            <Link href="/" className="hover:text-primary-600 transition-colors shrink-0">Home</Link>
            <ChevronRight size={14} className="shrink-0" />
            <Link href="/products" className="hover:text-primary-600 transition-colors shrink-0">Products</Link>
            {product.category && (<><ChevronRight size={14} className="shrink-0" /><Link href={`/categories/${product.category.handle}`} className="hover:text-primary-600 transition-colors shrink-0">{product.category.name}</Link></>)}
            <ChevronRight size={14} className="shrink-0" />
            <span className="text-gray-900 font-medium truncate">{product.title}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[4fr_5fr_4fr] gap-3 lg:gap-4 items-start">
                {/* Gallery */}
                <div className="card-base-static p-3 min-w-0">
                  <div className="relative rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
                    <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-1.5rem)]">
                      {shownDiscountPct > 0 && !isPriceHidden && <span className="chip-sale">{shownDiscountPct}% OFF</span>}
                      {productCustomBadges[0] && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-md shadow-sm max-w-full truncate"
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
                        className="relative w-full aspect-[4/3] overflow-hidden cursor-zoom-in"
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
                          className={`object-contain p-2 transition-transform duration-200 ease-out ${isZooming ? "md:scale-[1.8]" : "scale-100"}`}
                          style={{ transformOrigin: zoomOrigin }}
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 30vw"
                          priority
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] flex items-center justify-center">
                        <Package size={64} className="text-gray-200" />
                      </div>
                    )}
                    {galleryImages.length > 1 && (
                      <>
                        <button type="button" onClick={() => stepImage(-1)} aria-label="Previous image" className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition"><ChevronLeft size={18} /></button>
                        <button type="button" onClick={() => stepImage(1)} aria-label="Next image" className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition"><ChevronRight size={18} /></button>
                      </>
                    )}
                    {mainImage && (
                      <button type="button" onClick={() => setLightboxOpen(true)} aria-label="Zoom image" className="absolute right-3 bottom-3 w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition"><ZoomIn size={17} /></button>
                    )}
                  </div>
                  {galleryImages.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto pt-3 pb-1 [scrollbar-width:thin]">
                      {galleryImages.map((img, idx) => (
                        <button key={idx} type="button" onClick={() => setMainImage(img)} aria-label={`Show image ${idx + 1}`} className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 bg-white overflow-hidden transition-all duration-200 ${mainImage === img ? "border-primary-600 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
                          <Image src={img} alt={`${product.title} ${idx + 1}`} width={80} height={80} unoptimized={isExternalImageUrl(img)} className="w-full h-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="card-base-static p-4 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight tracking-tight">{product.title}</h1>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={toggleWishlist} disabled={wishlistLoading} aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"} className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${inWishlist ? "border-red-200 bg-red-50 text-red-500" : "border-gray-200 text-gray-500 hover:text-red-500 hover:bg-gray-50"}`}>
                        <Heart size={18} fill={inWishlist ? "currentColor" : "none"} />
                      </button>
                      <button type="button" onClick={handleShare} aria-label="Share" className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition"><Share2 size={18} /></button>
                    </div>
                  </div>
                  {(product.sku || product.vendorName) && <p className="text-sm text-gray-500 mt-1">{product.sku && <>SKU: {product.sku}</>}{product.sku && product.vendorName && <span className="mx-2 text-gray-300">|</span>}{product.vendorName && <>Seller: {product.vendorName}</>}</p>}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <div className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={17} fill={i <= Math.round(product.rating) ? "currentColor" : "none"} className={i <= Math.round(product.rating) ? "text-amber-400" : "text-gray-300"} />)}</div>
                    {product.reviewCount > 0 && <span className="text-sm font-bold text-gray-900">{Number(product.rating).toFixed(1)}</span>}
                    <span className="text-sm text-gray-500">({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})</span>
                  </div>
                  {product.description && (
                    <p className="text-gray-600 leading-relaxed mt-3 line-clamp-3 whitespace-pre-line text-sm">{product.description}</p>
                  )}
                  <div className="hidden md:block mt-4">{detailsTable}</div>
                </div>

            {/* Right column: price + bulk pricing */}
            <div className="md:col-span-2 lg:col-span-1 space-y-3 min-w-0">
              <div className="card-base-static p-4 space-y-3">
                {/* Price */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {isPriceHidden ? (
                      <span className="text-xl text-gray-500 italic">Contact us for pricing</span>
                    ) : (
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <span className="text-3xl sm:text-[34px] font-extrabold text-primary-700 tracking-tight">{formatPrice(shownPrice)}</span>
                        {strikePrice != null && <span className="text-base sm:text-lg text-gray-400 line-through">{formatPrice(strikePrice)}</span>}
                      </div>
                    )}
                    {!isPriceHidden && headlineLabel && (
                      <span className="inline-block mt-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ backgroundColor: role?.color || "#7c3aed", color: getContrastTextColor(role?.color || "#7c3aed") }}>{headlineLabel} Price</span>
                    )}
                  </div>
                  {!isPriceHidden && shownDiscountPct > 0 && <span className="chip-sale shrink-0">{shownDiscountPct}% OFF</span>}
                </div>

                {!isPriceHidden && roleHeadline?.roleMinQty != null && (
                  <div className="-mt-2">
                    <p className="text-xs text-gray-500">Min quantity - {roleHeadline.roleMinQty}</p>
                    {roleBelowMin && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Below {roleHeadline.roleMinQty} units you are charged the retail price of {formatPrice(Number(product.unitPrice))}/unit.
                      </p>
                    )}
                  </div>
                )}

                {/* Stock */}
                <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isOutOfStock ? "bg-red-500" : "bg-green-500"}`} />
                    <span className={isOutOfStock ? "text-red-600" : "text-green-600"}>{isOutOfStock ? "Out of Stock" : "In Stock"}</span>
                  </span>
                  {isLowStock && <span className="inline-flex items-center gap-1.5 text-xs text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-400" />Only {product.inventoryQuantity} left</span>}
                </div>

                {/* MOQ */}
                <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 text-sm font-bold text-gray-700">
                  <Package size={17} className="text-gray-400" /> MOQ: {roleHeadline?.roleMinQty ?? product.moq} units
                </div>

                {/* Price warnings */}
                {isNonPurchasable && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <span className="text-sm text-red-700 font-medium">{nonPurchasableMsg || "This product is not available for purchase"}</span>
                  </div>
                )}
                {ruleDiscount && !isPriceHidden && savingsPerUnit === 0 && (
                  <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                    <span className="text-sm text-green-700 font-medium">{ruleDiscount.ruleName}: {ruleDiscount.discountPercent}% off — save {formatPrice(ruleDiscount.discountAmount)}/unit</span>
                  </div>
                )}

                {/* Package Configurator or Add to Cart */}
                {packageData ? (
                  <PackageConfigurator pkg={packageData} userId={user?.id} />
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          onClick={decrement}
                          disabled={atMin}
                          title={atMin ? `Minimum order quantity is ${product.moq}` : undefined}
                          className="px-3 sm:px-3.5 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        ><Minus size={16} /></button>
                        <input
                          type="number" min={effectiveMinQty} max={effectiveMaxQty} value={quantity}
                          onChange={(e) => setTyped(Number(e.target.value))}
                          onBlur={flush}
                          onKeyDown={(e) => { if (e.key === "Enter") flush() }}
                          className="w-12 sm:w-16 text-center border-x border-gray-200 py-2.5 text-sm font-medium focus:outline-none"
                        />
                        <button onClick={increment} className="px-3 sm:px-3.5 py-2.5 hover:bg-gray-50 transition-colors"><Plus size={16} /></button>
                      </div>
                      <button onClick={handleAddToCart} disabled={adding || product.inventoryQuantity <= 0 || quantity < effectiveMinQty || quantity > effectiveMaxQty || isNonPurchasable} className="flex-1 min-w-0 whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {added ? <><Check size={18} /> Added!</> : adding ? "Adding..." : isNonPurchasable ? (nonPurchasableMsg || "Not Available") : quantity < effectiveMinQty ? "Adjust Quantity" : <><ShoppingCart size={18} /> Add to Cart</>}
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
                    className="flex items-center justify-center gap-2 h-12 rounded-xl border border-primary-200 bg-primary-50/60 text-primary-700 hover:bg-primary-50 hover:border-primary-300 transition-all text-sm font-bold"
                  >
                    <FileText size={17} /> Add to Quotation
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

              {/* Bulk quantity pricing */}
              {displayTierPrices.length > 0 && !isPriceHidden && (() => {
                const sortedTiers = sortTierPrices(displayTierPrices)
                return (
                  <div className="card-base-static p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h2 className="flex items-center gap-2.5 font-bold text-gray-900"><Layers size={20} className="text-gray-500" /> Bulk Quantity Pricing</h2>
                      <span className="text-sm font-semibold text-gray-500">Per Unit</span>
                    </div>
                    {roleTierPrices.length > 0 && (
                      <p className="text-xs text-primary-600 font-medium mb-2 flex items-center gap-1.5">
                        <Layers size={12} /> Special pricing for your account{priceLabel ? ` (${priceLabel})` : ""}
                      </p>
                    )}
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-1.5 space-y-1">
                      {sortedTiers.map((tp, idx) => {
                        const isActive = tp === activeTier
                        return (
                          <div key={tp.id ?? `${tp.minQty}-${idx}`} className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-primary-600 text-white font-bold shadow-sm" : "bg-white text-gray-700"}`}>
                            <span>{tp.minQty}{tp.maxQty ? ` - ${tp.maxQty}` : "+"} units</span>
                            <span className="font-bold">{formatPrice(Number(tp.price))}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                      <span className="text-gray-500">Total for {quantity} units</span>
                      <span className="font-bold text-gray-900">{formatPrice(totalCost)}</span>
                    </div>
                    {totalSavings > 0 && <p className="mt-1 text-xs font-semibold text-green-600 text-right">You save {formatPrice(totalSavings)}</p>}
                  </div>
                )
              })()}

              <div className="md:hidden card-base-static p-4">{detailsTable}</div>
            </div>
          </div>

          {/* Description + Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mt-3 lg:mt-4 items-stretch">
            <div className="card-base-static p-4 sm:p-5 min-w-0 h-full">
              <h2 className="heading-sm">Description</h2>
              <span className="block mt-1.5 mb-3 h-0.5 w-10 rounded bg-primary-600" />
              {product.description ? (
                <p className="text-gray-600 whitespace-pre-line leading-relaxed text-sm sm:text-base">{product.description}</p>
              ) : (
                <p className="text-gray-400 text-sm">No description provided.</p>
              )}
            </div>
            <div className="min-w-0">
              {/* Reviews */}
              <div className="card-base-static p-4 sm:p-5 h-full">
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
                  <div className="space-y-4">
                    {product.reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill={i <= review.rating ? "currentColor" : "none"} className={i <= review.rating ? "text-amber-400" : "text-gray-200"} />)}</div>
                          <span className="text-sm font-medium text-gray-900">{review.user.firstName || "Anonymous"} {review.user.lastName || ""}</span>
                        </div>
                        {review.title && <h4 className="font-semibold text-gray-900 mt-1">{review.title}</h4>}
                        {review.body && <p className="text-gray-600 text-sm mt-1 leading-relaxed">{review.body}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare size={36} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400">No reviews yet. Be the first to review!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mt-3 lg:mt-4">
            {trustItems.map((t) => (
              <div key={t.title} className="card-base-static flex items-center gap-3.5 p-3.5 sm:p-4">
                <span className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${t.tint}`}><t.icon size={22} /></span>
                <div className="min-w-0"><p className="text-sm font-bold text-gray-900">{t.title}</p><p className="text-xs text-gray-500">{t.sub}</p></div>
              </div>
            ))}
          </div>

          {/* Offers, pricing details, bank offers and tags */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 mt-3 lg:mt-4 items-start empty:hidden">
            <div className="lg:col-span-8 space-y-3 min-w-0 empty:hidden">
                {/* Available Offers */}
                {hasOffers && (
                  <CollapsibleSection title="Available Offers">
                    <div className="space-y-3">
                      {productBogo.map((b, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-pink-50">
                          <Gift size={16} className="text-pink-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-pink-800">Buy {b.buyQuantity}, Get {b.freeQuantity} Free</p>
                            <p className="text-xs text-pink-600">{b.ruleName}</p>
                          </div>
                        </div>
                      ))}
                      {productQtyDiscount && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-cyan-50">
                          <Layers size={16} className="text-cyan-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-cyan-800">{productQtyDiscount.ruleName}</p>
                            <div className="space-y-0.5 mt-1">
                              {[...productQtyDiscount.tiers].sort((a, b) => a.minQty - b.minQty).map((tier, i) => (
                                <p key={i} className="text-xs text-cyan-700">{tier.minQty}+ units: {tier.discountType === "PERCENTAGE" ? `${tier.discountValue}% off` : `${formatPrice(tier.discountValue)} off`}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {productExtraCharges.map((ec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50">
                          <PlusCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">{ec.chargeLabel}: {formatPrice(ec.chargeAmount)}</p>
                            <p className="text-xs text-amber-600">{ec.ruleName}</p>
                          </div>
                        </div>
                      ))}
                      {productShipping && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50">
                          <Truck size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-orange-800">{productShipping.ruleName}</p>
                            <p className="text-xs text-orange-600">Shipping: {productShipping.cost > 0 ? formatPrice(productShipping.cost) : "Free"}</p>
                          </div>
                        </div>
                      )}
                      {productTaxes.map((tax, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                          <AlertTriangle size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{tax.taxLabel}: {tax.taxRate}%</p>
                            <p className="text-xs text-gray-500">{tax.ruleName}</p>
                          </div>
                        </div>
                      ))}
                      {minQtyRule && <p className="text-sm text-amber-700 flex items-center gap-1"><AlertTriangle size={14} /> Minimum order: {minQtyRule.minQty} units</p>}
                      {maxQtyRule && <p className="text-sm text-red-700 flex items-center gap-1"><AlertTriangle size={14} /> Maximum order: {maxQtyRule.maxQty} units</p>}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Pricing Details */}
                {hasPricingInfo && (
                  <CollapsibleSection title="Pricing Details">
                    <div className="space-y-2">
                      {pricingIsCurrent && pricing!.appliedRule === "role" && pricing!.rolePrice != null && (
                        <p className="text-sm text-purple-700 font-medium">Your {pricing!.appliedRoleName} Price: {formatPrice(pricing!.rolePrice)}/unit <span className="font-normal text-purple-500">{pricing!.rolePrice < pricing!.basePrice ? `(saved ${formatPrice(pricing!.basePrice - pricing!.rolePrice)}/unit)` : ""}</span></p>
                      )}
                      {pricingIsCurrent && pricing!.appliedRule === "contract" && pricing!.contractPrice != null && (
                        <p className="text-sm text-blue-700 font-medium">Contract Price: {formatPrice(pricing!.contractPrice)}/unit <span className="font-normal text-blue-500">{pricing!.contractPrice < pricing!.basePrice ? `(saved ${formatPrice(pricing!.basePrice - pricing!.contractPrice)}/unit)` : ""}</span></p>
                      )}
                      {pricingIsCurrent && (pricing?.seasonalDiscount ?? 0) > 0 && (
                        <p className="text-sm text-orange-700 font-medium">Seasonal Discount: -{formatPrice(pricing!.seasonalDiscount)}/unit ({pricing!.discountPercent.toFixed(1)}% off)</p>
                      )}
                      {ruleDiscount && (
                        <p className="text-sm text-green-700 font-medium">{ruleDiscount.ruleName}: {ruleDiscount.discountPercent}% off — save {formatPrice(ruleDiscount.discountAmount)}/unit</p>
                      )}
                      {pricingIsCurrent && pricing!.appliedDiscounts && pricing!.appliedDiscounts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {pricing!.appliedDiscounts.map((d, i) => (
                            <span key={i} className="badge badge-primary">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
            </div>
            <div className="lg:col-span-4 space-y-3 min-w-0 empty:hidden">
              {/* Bank & UPI Offers — shown directly below price, Amazon/Flipkart style */}
              {paymentOffers.length > 0 && !isPriceHidden && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Bank Offers</span>
                    <button onClick={() => setShowOffersModal(true)} className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                      View All Offers
                    </button>
                  </div>
                  <div className="p-3 space-y-2.5">
                    {paymentOffers.slice(0, 3).map((offer) => (
                      <BankOfferCard key={offer.id} offer={offer} />
                    ))}
                  </div>
                  {paymentOffers.length > 3 && (
                    <button onClick={() => setShowOffersModal(true)} className="w-full text-center py-2.5 text-xs font-semibold text-primary-600 hover:bg-primary-50 border-t border-gray-100 transition-colors">
                      +{paymentOffers.length - 3} more offer{paymentOffers.length - 3 !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )}
              {product.tags.length > 0 && (
                <div className="card-base-static p-4 flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="badge bg-gray-100 text-gray-600">{tag}</span>)}</div>
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
