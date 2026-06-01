"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ShoppingCart, Heart, GitCompare, Star, Truck, Package, ShieldCheck, ChevronRight, MessageSquare, Flame } from "lucide-react"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { PricingBreakdown, SeasonalDiscount, fetchPricing, fetchSeasonalDiscounts, getProductDiscount, discountBadge } from "@/lib/pricing"

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

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<RelatedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
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
      .then((data) => {
        const items = data.items || []
        setInWishlist(items.some((i: any) => i.productId === productId))
      })
      .catch(() => {})
  }

  const loadRelated = (p: Product) => {
    if (!p.category) return
    fetch(`/api/categories/${p.category.handle}`)
      .then((res) => res.json())
      .then((data) => {
        const prods = (data.category?.products || []).filter((rp: any) => rp.id !== p.id).slice(0, 4)
        setRelated(prods)
      })
      .catch(() => {})
  }

  const handleAddToCart = async () => {
    if (!product) return
    setAdding(true)
    try {
      await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() }, body: JSON.stringify({ productId: product.id, quantity }) })
      window.dispatchEvent(new CustomEvent("cart-updated"))
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

  const addToCompare = () => {
    if (!product) return
    const stored = localStorage.getItem("compareItems")
    const items: string[] = stored ? JSON.parse(stored) : []
    if (!items.includes(product.id)) {
      if (items.length >= 4) { alert("Max 4 products to compare. Remove one first."); return }
      items.push(product.id)
      localStorage.setItem("compareItems", JSON.stringify(items))
    }
    alert("Added to comparison!")
  }

  const checkUserReview = (productId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return
    fetch(`/api/reviews?productId=${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        const mine = (data.reviews || []).filter((r: any) => r.user?.id)
        setUserHasReviewed(mine.length > 0)
      })
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
        setReviewTitle("")
        setReviewBody("")
        setReviewRating(5)
        // Refresh product to show new review
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
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (qty >= sorted[i].minQty) return sorted[i].price
    }
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
    ? Math.round(((Number(product.compareAtPrice) - effectivePrice) / Number(product.compareAtPrice)) * 100)
    : 0

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
  if (!product) return <div className="min-h-screen flex flex-col items-center justify-center"><h1 className="text-2xl font-bold">Product not found</h1><Link href="/products" className="mt-4 text-primary-600">Back to products</Link></div>

  const productJsonLd = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || `${product.title} — wholesale pricing from MOQ ${product.moq}`,
    image: product.thumbnail || (product.images?.[0] ?? undefined),
    sku: product.sku || undefined,
    brand: product.vendorName ? { "@type": "Brand", name: product.vendorName } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.unitPrice,
      availability: product.inventoryQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      minPrice: product.tierPrices?.length > 0 ? product.tierPrices[product.tierPrices.length - 1].price : undefined,
      url: typeof window !== "undefined" ? `${window.location.origin}/products/${product.handle}` : undefined,
    },
    aggregateRating: product.reviewCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    } : undefined,
  } : null

  return (
    <>
      {productJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />}
      <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary-600">Home</Link>
          <ChevronRight size={14} />
          <Link href="/products" className="hover:text-primary-600">Products</Link>
          {product.category && (<><ChevronRight size={14} /><Link href={`/categories/${product.category.handle}`} className="hover:text-primary-600">{product.category.name}</Link></>)}
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium truncate">{product.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            {mainImage ? (
              <img src={mainImage} alt={product.title} className="w-full h-96 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-96 bg-gray-100 flex items-center justify-center"><Package size={64} className="text-gray-300" /></div>
            )}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 p-4 overflow-x-auto">
                {product.images.map((img, idx) => (
                  <button key={idx} onClick={() => setMainImage(img)} className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden ${mainImage === img ? 'border-primary-600' : 'border-transparent'}`}>
                    <img src={img} alt={`${product.title} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-5">
            {product.category && <Link href={`/categories/${product.category.handle}`} className="text-sm text-primary-600 hover:underline">{product.category.name}</Link>}
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 flex-wrap">{product.title} {product.tags?.includes('best-seller') && <span className="text-sm bg-amber-500 text-white px-2 py-0.5 rounded font-semibold">Best Seller</span>}{getProductDiscount(discounts, product.id, product.categoryId || product.category?.id) && <span className="text-sm bg-orange-500 text-white px-2 py-0.5 rounded font-semibold flex items-center gap-1"><Flame size={12} />{discountBadge(getProductDiscount(discounts, product.id, product.categoryId || product.category?.id)!)}</span>}</h1>

            <div className="flex items-center gap-2">
              <div className="flex text-yellow-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={18} fill={i < Math.round(product.rating) ? "currentColor" : "none"} className={i < Math.round(product.rating) ? "" : "text-gray-300"} />)}</div>
              <span className="text-sm text-gray-500">({product.reviewCount} reviews)</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary-700">{formatPrice(Number(effectivePrice))}</span>
              {product.compareAtPrice && effectivePrice < Number(product.compareAtPrice) && (
                <>
                  <span className="text-lg text-gray-400 line-through">{formatPrice(Number(product.compareAtPrice))}</span>
                  <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">{discountPercent}% off</span>
                </>
              )}
            </div>

            {savingsPerUnit > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                <span className="text-sm text-green-700 font-medium">Bulk savings: {formatPrice(savingsPerUnit)}/unit off - you save {formatPrice(totalSavings)} total</span>
              </div>
            )}

            {/* Contract / Seasonal Pricing Info */}
            {pricing && (pricing.rolePrice !== null || pricing.contractPrice !== null || pricing.seasonalDiscount > 0) && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 space-y-1">
                {pricing.rolePrice !== null && pricing.rolePrice < pricing.basePrice && (
                  <p className="text-sm text-purple-700 font-medium">Your Role Price ({pricing.appliedRoleName}): {formatPrice(pricing.rolePrice)}/unit <span className="font-normal text-purple-500">(saved {formatPrice(pricing.basePrice - pricing.rolePrice)}/unit)</span></p>
                )}
                {pricing.contractPrice !== null && pricing.contractPrice < pricing.basePrice && (
                  <p className="text-sm text-blue-700 font-medium">Your Contract Price: {formatPrice(pricing.contractPrice)}/unit <span className="font-normal text-blue-500">(saved {formatPrice(pricing.basePrice - pricing.contractPrice)}/unit)</span></p>
                )}
                {pricing.seasonalDiscount > 0 && (
                  <p className="text-sm text-orange-700 font-medium">Seasonal Discount: -{formatPrice(pricing.seasonalDiscount)}/unit <span className="font-normal text-orange-500">({pricing.discountPercent.toFixed(1)}% off)</span></p>
                )}
                {pricing.appliedDiscounts?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pricing.appliedDiscounts.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white text-xs font-medium text-primary-700 rounded-full border border-primary-200">{d}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {product.sku && <p className="text-sm text-gray-500">SKU: {product.sku}</p>}
            {product.vendorName && <p className="text-sm text-gray-500">Vendor: {product.vendorName}</p>}
            <div className="flex items-center gap-2 text-sm text-gray-600"><Package size={16} /><span>MOQ: {product.moq} units</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><Truck size={16} /><span>{product.inventoryQuantity > 0 ? `${product.inventoryQuantity} in stock` : "Out of stock"}</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><ShieldCheck size={16} /><span>Secure checkout via CCAvenue</span></div>

            {/* Quantity + Actions */}
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button onClick={() => setQuantity(Math.max(product.moq, quantity - 1))} className="px-3 py-2 hover:bg-gray-50">-</button>
                <input type="number" min={product.moq} max={product.inventoryQuantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-16 text-center border-x border-gray-200 py-2" />
                <button onClick={() => setQuantity(Math.min(product.inventoryQuantity, quantity + 1))} className="px-3 py-2 hover:bg-gray-50">+</button>
              </div>
              <button onClick={handleAddToCart} disabled={adding || product.inventoryQuantity <= 0 || quantity < product.moq} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium">
                <ShoppingCart size={18} /> {adding ? "Adding..." : "Add to Cart"}
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={toggleWishlist} disabled={wishlistLoading} className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition text-sm font-medium ${inWishlist ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                <Heart size={16} fill={inWishlist ? "currentColor" : "none"} /> {inWishlist ? "Saved" : "Wishlist"}
              </button>
              <button onClick={addToCompare} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition text-sm font-medium">
                <GitCompare size={16} /> Compare
              </button>
            </div>

            {product.tags.length > 0 && <div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>)}</div>}
          </div>
        </div>

        {/* Tier Pricing Table */}
        {product.tierPrices.length > 0 && (
          <div className="mt-10 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tier Pricing</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Quantity Range</th><th className="px-4 py-3 text-right font-medium text-gray-600">Price/unit</th><th className="px-4 py-3 text-right font-medium text-gray-600">You Save</th></tr></thead>
                <tbody>
                  {product.tierPrices.map((tp) => {
                    const saving = Number(product.unitPrice) - Number(tp.price)
                    const isActive = quantity >= tp.minQty && (!tp.maxQty || quantity <= tp.maxQty)
                    return (
                      <tr key={tp.id} className={`border-b border-gray-50 ${isActive ? "bg-primary-50" : ""}`}>
                        <td className="px-4 py-3 font-medium">{tp.minQty}{tp.maxQty ? ` - ${tp.maxQty}` : "+"} units</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatPrice(Number(tp.price))}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{saving > 0 ? formatPrice(saving) : "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bulk Discount Calculator */}
        {product.tierPrices.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk Discount Calculator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Quantity</p>
                <p className="text-2xl font-bold text-gray-900">{quantity}</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-4">
                <p className="text-sm text-primary-600 mb-1">Effective Price</p>
                <p className="text-2xl font-bold text-primary-700">{formatPrice(pricing?.finalPrice || Number(effectivePrice))}<span className="text-sm font-normal">/unit</span></p>
                {pricing && pricing.discountPercent > 0 && <p className="text-xs text-primary-500 mt-1">incl. all discounts</p>}
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-green-700">{formatPrice((pricing?.finalPrice || Number(effectivePrice)) * quantity)}</p>
                {totalSavings > 0 && <p className="text-xs text-green-600 mt-1">Save {formatPrice(totalSavings)}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-10 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-10 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Reviews ({product.reviewCount})</h2>
            {!userHasReviewed && localStorage.getItem("token") && !showReviewForm && (
              <button onClick={() => setShowReviewForm(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium">
                <MessageSquare size={14} /> Write a Review
              </button>
            )}
            {userHasReviewed && (
              <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full font-medium">You've reviewed this product</span>
            )}
          </div>

          {/* Write Review Form */}
          {showReviewForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Write Your Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button key={val} onClick={() => setReviewRating(val)} className="focus:outline-none">
                        <Star size={28} fill={val <= reviewRating ? "currentColor" : "none"} className={val <= reviewRating ? "text-yellow-500" : "text-gray-300"} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Title (optional)</label>
                  <input type="text" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Summarize your experience" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Your Review *</label>
                  <textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} rows={4} placeholder="Share your experience with this product..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSubmitReview} disabled={submittingReview || !reviewBody.trim()} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                  <button onClick={() => setShowReviewForm(false)} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          {product.reviews.length > 0 ? (
            <div className="space-y-5">
              {product.reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex text-yellow-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-gray-300"} />)}</div>
                    <span className="text-sm font-medium text-gray-900">{review.user.firstName || "Anonymous"} {review.user.lastName || ""}</span>
                  </div>
                  {review.title && <h4 className="font-semibold text-gray-900 mt-1">{review.title}</h4>}
                  {review.body && <p className="text-gray-600 text-sm mt-1.5 leading-relaxed">{review.body}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No reviews yet. Be the first to review this product!</p>
            </div>
          )}
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Related Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map((rp) => {
                const lowestTier = rp.tierPrices?.length > 0 ? rp.tierPrices[rp.tierPrices.length - 1] : null
                return (
                  <Link key={rp.id} href={`/products/${rp.handle}`} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group">
                    <div className="relative h-40 bg-gray-100">
                      {rp.thumbnail ? (
                        <img src={rp.thumbnail} alt={rp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-gray-300" /></div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition">{rp.title}</h3>
                      <div className="flex items-center gap-1 mb-2">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs text-gray-600">{rp.rating}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {lowestTier ? (
                          <>
                            <span className="text-xs text-green-600 font-semibold">From </span>
                            <span className="font-bold text-gray-900">{formatPrice(lowestTier.price)}</span>
                            <span className="text-xs text-gray-400 line-through">{formatPrice(rp.unitPrice)}</span>
                          </>
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