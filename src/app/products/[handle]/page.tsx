"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, Heart, Star, Truck, Package, ShieldCheck, ChevronRight, ChevronDown, MessageSquare, Flame, Gift, Layers, PlusCircle, AlertTriangle, Minus, Plus, Share2, Check } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { PricingBreakdown, SeasonalDiscount, PaymentOffer, fetchPricing, fetchSeasonalDiscounts, fetchPaymentOffers, getProductDiscount, discountBadge, getPaymentOfferBadge, getPaymentOfferLabel } from "@/lib/pricing"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"
import dynamic from "next/dynamic"

const PackageConfigurator = dynamic(() => import("@/components/storefront/PackageConfigurator"), { ssr: false })

interface TierPrice { id: string; minQty: number; maxQty: number | null; price: number }
interface Review { id: string; rating: number; title: string | null; body: string | null; user: { firstName: string | null; lastName: string | null } }
interface RelatedProduct {
  id: string; title: string; handle: string; thumbnail: string | null; unitPrice: string; compareAtPrice: string | null; moq: number; rating: number; tierPrices: TierPrice[]
}
interface Product {
  id: string; title: string; handle: string; description: string | null; sku: string | null; moq: number;
  unitPrice: number; compareAtPrice: number | null; inventoryQuantity: number; thumbnail: string | null;
  images: string[]; vendorName: string | null; rating: number; reviewCount: number; tags: string[];
  category: { id: string; name: string; handle: string } | null;
  tierPrices: TierPrice[]; reviews: Review[];
  categoryId?: string
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
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [inWishlist, setInWishlist] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState("")
  const [reviewBody, setReviewBody] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [userHasReviewed, setUserHasReviewed] = useState(false)
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null)
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [paymentOffers, setPaymentOffers] = useState<PaymentOffer[]>([])
  const [packageData, setPackageData] = useState<any>(null)
  const { user, role } = useAuth()

  const rulesProducts = useMemo(
    () => product ? [{ id: product.id, categoryId: product.categoryId || product.category?.id, unitPrice: product.unitPrice }] : [],
    [product?.id, product?.categoryId, product?.category?.id, product?.unitPrice]
  )
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts, extraCharges, shipping, taxes, minimumOrderQuantities, maximumOrderQuantities } = useStorefrontRules(rulesProducts, quantity)

  const ruleDiscount = productDiscounts?.find((d) => d.productId === product?.id) ?? null
  const productBogo = bogo.filter((b) => b.buyProductId === product?.id)
  const productQtyDiscount = quantityDiscounts.find((qd) => qd.productId === product?.id)
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
          setQuantity(data.product.moq)
          setMainImage(data.product.thumbnail || (data.product.images?.[0] ?? null))
          loadRelated(data.product)
          checkWishlist(data.product.id)
          checkUserReview(data.product.id)
          loadPricing(data.product)
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

  const loadPricing = (p: Product) => {
    const token = localStorage.getItem("token")
    if (!token) return
    const userId = JSON.parse(atob(token.split(".")[1]))?.userId || JSON.parse(atob(token.split(".")[1]))?.sub
    if (!userId) return
    fetchPricing(p.id, 1, userId).then(setPricing)
  }

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
      await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId: product.id, quantity }) })
      window.dispatchEvent(new CustomEvent("cart-updated"))
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch (err) { console.error(err) } finally { setAdding(false) }
  }

  const toggleWishlist = async () => {
    if (!product) return
    const token = localStorage.getItem("token")
    if (!token) { alert("Please sign in to add items to your wishlist"); return }
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
        alert(data.message || "Failed to submit review")
      }
    } catch (err) { console.error(err) } finally { setSubmittingReview(false) }
  }

  const getEffectiveTierPrice = (qty: number) => {
    if (!product) return 0
    const sorted = [...product.tierPrices].sort((a, b) => a.minQty - b.minQty)
    for (let i = sorted.length - 1; i >= 0; i--) { if (qty >= sorted[i].minQty) return sorted[i].price }
    return product.unitPrice
  }

  useEffect(() => {
    if (!product || !pricing) return
    const token = localStorage.getItem("token")
    if (!token) return
    const userId = JSON.parse(atob(token.split(".")[1]))?.userId || JSON.parse(atob(token.split(".")[1]))?.sub
    if (!userId) return
    fetchPricing(product.id, quantity, userId).then(setPricing)
  }, [quantity, product?.id])

  const effectivePrice = getEffectiveTierPrice(quantity)
  const totalCost = effectivePrice * quantity
  const savingsPerUnit = product ? Number(product.unitPrice) - effectivePrice : 0
  const totalSavings = savingsPerUnit * quantity
  const discountPercent = product?.compareAtPrice && effectivePrice < Number(product.compareAtPrice)
    ? Math.round(((Number(product.compareAtPrice) - effectivePrice) / Number(product.compareAtPrice)) * 100) : 0

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

  const displayPrice = pricing?.rolePrice && pricing.rolePrice < effectivePrice ? pricing.rolePrice : pricing?.finalPrice || effectivePrice
  const priceLabel = pricing?.rolePrice && pricing.rolePrice < effectivePrice ? pricing.appliedRoleName : null

  const productJsonLd = product ? {
    "@context": "https://schema.org", "@type": "Product", name: product.title,
    description: product.description || `${product.title} — wholesale pricing from MOQ ${product.moq}`,
    image: product.thumbnail || (product.images?.[0] ?? undefined), sku: product.sku || undefined,
    brand: product.vendorName ? { "@type": "Brand", name: product.vendorName } : undefined,
    offers: { "@type": "Offer", priceCurrency: "INR", price: product.unitPrice, availability: product.inventoryQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: typeof window !== "undefined" ? `${window.location.origin}/products/${product.handle}` : undefined },
    aggregateRating: product.reviewCount > 0 ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } : undefined,
  } : null

  const effectiveMinQty = minQtyRule ? Math.max(product.moq, minQtyRule.minQty) : product.moq
  const effectiveMaxQty = maxQtyRule ? Math.min(product.inventoryQuantity, maxQtyRule.maxQty) : product.inventoryQuantity

  // Collect all offer/rule sections for collapsible area
  const hasOffers = paymentOffers.length > 0 || productBogo.length > 0 || productQtyDiscount || productExtraCharges.length > 0 || productShipping || productTaxes.length > 0 || (minQtyRule || maxQtyRule)
  const hasPricingInfo = (pricing && (pricing.rolePrice !== null || pricing.contractPrice !== null || pricing.seasonalDiscount > 0)) || ruleDiscount

  return (
    <>
      {productJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />}
      <div className="min-h-screen bg-gray-50/50">
        <main className="section-container py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-primary-600 transition-colors">Home</Link>
            <ChevronRight size={14} />
            <Link href="/products" className="hover:text-primary-600 transition-colors">Products</Link>
            {product.category && (<><ChevronRight size={14} /><Link href={`/categories/${product.category.handle}`} className="hover:text-primary-600 transition-colors">{product.category.name}</Link></>)}
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium truncate">{product.title}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Left: Images — 3 cols on lg */}
            <div className="lg:col-span-3 space-y-4">
              {/* Main image */}
              <div className="card-base-static overflow-hidden">
                {mainImage ? (
                  <div className="relative w-full aspect-square">
                    <Image src={mainImage} alt={product.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" priority />
                  </div>
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                    <Package size={64} className="text-gray-200" />
                  </div>
                )}
              </div>
              {/* Thumbnails */}
              {product.images && product.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {product.images.map((img, idx) => (
                    <button key={idx} onClick={() => setMainImage(img)} className={`flex-shrink-0 w-20 h-20 rounded-xl border-2 overflow-hidden transition-all duration-200 ${mainImage === img ? "border-primary-600 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
                      <Image src={img} alt={`${product.title} ${idx + 1}`} width={80} height={80} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Collapsible sections below image */}
              <div className="space-y-3">
                {/* Description */}
                {product.description && (
                  <CollapsibleSection title="Description" defaultOpen={true}>
                    <p className="text-gray-600 whitespace-pre-line leading-relaxed">{product.description}</p>
                  </CollapsibleSection>
                )}

                {/* Tier Pricing */}
                {product.tierPrices.length > 0 && (
                  <CollapsibleSection title="Bulk Pricing" icon={Layers}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-100"><th className="px-4 py-3 text-left font-medium text-gray-500">Quantity</th><th className="px-4 py-3 text-right font-medium text-gray-500">Price/unit</th><th className="px-4 py-3 text-right font-medium text-gray-500">You Save</th></tr></thead>
                        <tbody>
                          {product.tierPrices.map((tp) => {
                            const saving = Number(product.unitPrice) - Number(tp.price)
                            const isActive = quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty)
                            return (
                              <tr key={tp.id} className={`border-b border-gray-50 ${isActive ? "bg-primary-50" : ""}`}>
                                <td className="px-4 py-3 font-medium">{tp.minQty}{tp.maxQty ? ` - ${tp.maxQty}` : "+"} units</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatPrice(Number(tp.price))}</td>
                                <td className="px-4 py-3 text-right text-green-600 font-medium">{saving > 0 ? formatPrice(saving) : "—"}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Calculator */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="body-sm text-gray-500">Quantity</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{quantity}</p>
                      </div>
                      <div className="bg-primary-50 rounded-xl p-4 text-center">
                        <p className="body-sm text-primary-600">Price/unit</p>
                        <p className="text-2xl font-bold text-primary-700 mt-1">{formatPrice(Number(displayPrice))}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 text-center">
                        <p className="body-sm text-green-600">Total</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{formatPrice(totalCost)}</p>
                        {totalSavings > 0 && <p className="text-xs text-green-600 mt-1">Save {formatPrice(totalSavings)}</p>}
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Available Offers */}
                {hasOffers && (
                  <CollapsibleSection title="Available Offers">
                    <div className="space-y-3">
                      {paymentOffers.map((offer) => (
                        <div key={offer.id} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0 ${offer.offerType === "BANK" ? "bg-blue-600" : "bg-purple-600"}`}>
                            {offer.offerType === "BANK" ? "BANK" : "UPI"}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{offer.name}</p>
                            <p className="text-xs text-gray-600">{getPaymentOfferLabel(offer)}</p>
                          </div>
                        </div>
                      ))}
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
                      {pricing?.rolePrice != null && pricing.rolePrice < pricing.basePrice && (
                        <p className="text-sm text-purple-700 font-medium">Your {pricing.appliedRoleName} Price: {formatPrice(pricing.rolePrice)}/unit <span className="font-normal text-purple-500">(saved {formatPrice(pricing.basePrice - pricing.rolePrice)}/unit)</span></p>
                      )}
                      {pricing?.contractPrice != null && pricing.contractPrice < pricing.basePrice && (
                        <p className="text-sm text-blue-700 font-medium">Contract Price: {formatPrice(pricing.contractPrice)}/unit <span className="font-normal text-blue-500">(saved {formatPrice(pricing.basePrice - pricing.contractPrice)}/unit)</span></p>
                      )}
                      {(pricing?.seasonalDiscount ?? 0) > 0 && (
                        <p className="text-sm text-orange-700 font-medium">Seasonal Discount: -{formatPrice(pricing!.seasonalDiscount)}/unit ({pricing!.discountPercent.toFixed(1)}% off)</p>
                      )}
                      {ruleDiscount && (
                        <p className="text-sm text-green-700 font-medium">{ruleDiscount.ruleName}: {ruleDiscount.discountPercent}% off — save {formatPrice(ruleDiscount.discountAmount)}/unit</p>
                      )}
                      {pricing?.appliedDiscounts && pricing.appliedDiscounts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {pricing.appliedDiscounts.map((d, i) => (
                            <span key={i} className="badge badge-primary">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>

              {/* Reviews */}
              <div className="card-base-static p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="heading-sm">Reviews ({product.reviewCount})</h2>
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
                    <div className="space-y-4">
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

            {/* Right: Sticky sidebar — 2 cols on lg */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 space-y-5">
                {/* Main product info card */}
                <div className="card-base-static p-6 space-y-5">
                  {/* Category + Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {product.category && <Link href={`/categories/${product.category.handle}`} className="badge badge-primary">{product.category.name}</Link>}
                    {product.tags?.includes("best-seller") && <span className="badge badge-warning">Best Seller</span>}
                    {getProductDiscount(discounts, product.id, product.categoryId || product.category?.id) && <span className="badge badge-warning flex items-center gap-1"><Flame size={10} />{discountBadge(getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)!)}</span>}
                    {paymentOffers.filter(o => o.productId === product.id || (!o.productId && !o.categoryId)).slice(0, 2).map((offer) => (
                      <span key={offer.id} className={`badge ${offer.offerType === "BANK" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{getPaymentOfferBadge(offer)}</span>
                    ))}
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">{product.title}</h1>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={18} fill={i <= Math.round(product.rating) ? "currentColor" : "none"} className={i <= Math.round(product.rating) ? "text-amber-400" : "text-gray-200"} />)}</div>
                    <span className="text-sm text-gray-500">({product.reviewCount} reviews)</span>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-3 flex-wrap">
                    {isPriceHidden ? (
                      <span className="text-xl text-gray-500 italic">Contact us for pricing</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-primary-700">{formatPrice(Number(ruleDiscount ? product.unitPrice - ruleDiscount.discountAmount : displayPrice))}</span>
                        {priceLabel && (
                          <span className="text-sm font-medium px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: role?.color || "#7c3aed" }}>{priceLabel} Price</span>
                        )}
                        {ruleDiscount && Number(product.unitPrice) > (Number(product.unitPrice) - ruleDiscount.discountAmount) && (
                          <span className="text-lg text-gray-400 line-through">{formatPrice(Number(product.unitPrice))}</span>
                        )}
                        {!ruleDiscount && Number(product.unitPrice) > Number(displayPrice) && (
                          <span className="text-lg text-gray-400 line-through">{formatPrice(Number(product.unitPrice))}</span>
                        )}
                        {ruleDiscount && <span className="badge badge-success">{ruleDiscount.discountPercent}% off</span>}
                        {!ruleDiscount && product.compareAtPrice && Number(displayPrice) < Number(product.compareAtPrice) && (
                          <span className="badge badge-success">{discountPercent}% off</span>
                        )}
                      </>
                    )}
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

                  {/* Meta info */}
                  <div className="space-y-2">
                    {product.sku && <p className="body-sm">SKU: {product.sku}</p>}
                    {product.vendorName && <p className="body-sm">Vendor: {product.vendorName}</p>}
                    <div className="flex items-center gap-2 text-sm text-gray-600"><Package size={15} className="text-gray-400" /><span>MOQ: {product.moq} units</span></div>
                    <div className="flex items-center gap-2 text-sm text-gray-600"><Truck size={15} className="text-gray-400" /><span>{product.inventoryQuantity > 0 ? `${product.inventoryQuantity} in stock` : "Out of stock"}</span></div>
                    <div className="flex items-center gap-2 text-sm text-gray-600"><ShieldCheck size={15} className="text-gray-400" /><span>Secure checkout</span></div>
                  </div>

                  {/* Rule badges */}
                  <ProductRuleBadge
                    priceHidden={isPriceHidden}
                    nonPurchasable={isNonPurchasable}
                    nonPurchasableMessage={nonPurchasableMsg}
                    hasRolePrice={!!(pricing?.rolePrice && pricing.rolePrice < pricing.basePrice)}
                    roleLabel={pricing?.appliedRoleName || undefined}
                    bogoLabel={productBogo.length > 0 ? `Buy ${productBogo[0].buyQuantity} Get ${productBogo[0].freeQuantity} Free` : undefined}
                    quantityDiscountLabel={productQtyDiscount ? productQtyDiscount.ruleName : undefined}
                    discountLabel={ruleDiscount?.ruleName}
                    discountPercent={ruleDiscount?.discountPercent}
                  />

                  {/* Package Configurator or Add to Cart */}
                  {packageData ? (
                    <PackageConfigurator pkg={packageData} userId={user?.id} />
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                          <button onClick={() => setQuantity(Math.max(effectiveMinQty, quantity - 1))} className="px-3.5 py-2.5 hover:bg-gray-50 transition-colors"><Minus size={16} /></button>
                          <input type="number" min={effectiveMinQty} max={effectiveMaxQty} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-16 text-center border-x border-gray-200 py-2.5 text-sm font-medium focus:outline-none" />
                          <button onClick={() => setQuantity(Math.min(effectiveMaxQty, quantity + 1))} className="px-3.5 py-2.5 hover:bg-gray-50 transition-colors"><Plus size={16} /></button>
                        </div>
                        <button onClick={handleAddToCart} disabled={adding || product.inventoryQuantity <= 0 || quantity < effectiveMinQty || quantity > effectiveMaxQty || isNonPurchasable} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                          {added ? <><Check size={18} /> Added!</> : adding ? "Adding..." : isNonPurchasable ? (nonPurchasableMsg || "Not Available") : quantity < effectiveMinQty ? "Adjust Quantity" : <><ShoppingCart size={18} /> Add to Cart</>}
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={toggleWishlist} disabled={wishlistLoading} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${inWishlist ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                          <Heart size={16} fill={inWishlist ? "currentColor" : "none"} /> {inWishlist ? "Saved" : "Wishlist"}
                        </button>
                      </div>
                    </>
                  )}

                  {product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="badge bg-gray-100 text-gray-600">{tag}</span>)}</div>
                  )}
                </div>

                {/* Trust signals */}
                <div className="card-base-static p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50">
                      <Truck size={18} className="text-primary-600" />
                      <div><p className="text-xs font-semibold text-gray-900">Fast Delivery</p><p className="text-[10px] text-gray-500">Across India</p></div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50">
                      <ShieldCheck size={18} className="text-primary-600" />
                      <div><p className="text-xs font-semibold text-gray-900">Secure</p><p className="text-[10px] text-gray-500">Safe checkout</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {related.length > 0 && (
            <div className="mt-12">
              <div className="section-header">
                <h2 className="heading-lg">Related Products</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {related.map((rp) => {
                  const lowestTier = rp.tierPrices?.length > 0 ? rp.tierPrices[rp.tierPrices.length - 1] : null
                  return (
                    <Link key={rp.id} href={`/products/${rp.handle}`} className="card-base overflow-hidden group">
                      <div className="relative aspect-square bg-gray-50 overflow-hidden">
                        {rp.thumbnail ? (
                          <Image src={rp.thumbnail} alt={rp.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 640px) 50vw, 25vw" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-gray-200" /></div>
                        )}
                      </div>
                      <div className="p-3.5">
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">{rp.title}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs text-gray-500">{rp.rating}</span>
                        </div>
                        <div className="mt-1.5">
                          {lowestTier ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs text-green-600 font-semibold">From</span>
                              <span className="font-bold text-gray-900">{formatPrice(lowestTier.price)}</span>
                            </div>
                          ) : (
                            <span className="font-bold text-gray-900">{formatPrice(rp.unitPrice)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}