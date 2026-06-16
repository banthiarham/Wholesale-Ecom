"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  ShoppingCart,
  Star,
  ArrowRight,
  Package,
  Flame,
} from "lucide-react"

import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount, discountBadge } from "@/lib/pricing"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import ProductRuleBadge from "@/lib/rules/ProductRuleBadge"

// Home section components
import AnnouncementBar from "@/components/home/AnnouncementBar"
import HeroBannerCarousel from "@/components/home/HeroBannerCarousel"
import CategoryIconStrip from "@/components/home/CategoryIconStrip"
import TopSellingSection from "@/components/home/TopSellingSection"
import TrustBadgesSection from "@/components/home/TrustBadgesSection"
import MidPromotionalBanner from "@/components/home/MidPromotionalBanner"
import ShopByCategoryGrid from "@/components/home/ShopByCategoryGrid"
import CTABannerSection from "@/components/home/CTABannerSection"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TierPrice { minQty: number; maxQty: number | null; price: string }

interface Product {
  id: string
  title: string
  handle: string
  unitPrice: string
  compareAtPrice: string
  moq: number
  thumbnail: string | null
  images: string[]
  vendorName: string
  rating: number
  reviewCount: number
  category: { name: string; handle: string; id?: string }
  inventoryQuantity: number
  tierPrices: TierPrice[]
  categoryId?: string
}

interface Category {
  id: string
  name: string
  handle: string
  _count?: { products: number }
  children?: Category[]
}

interface HomeSection {
  id: string
  type: string
  title: string | null
  subtitle: string | null
  config: any
  rank: number
  isActive: boolean
  categoryId: string | null
  category: { id: string; name: string; handle: string } | null
}

/* ------------------------------------------------------------------ */
/*  Section type → component mapper                                    */
/* ------------------------------------------------------------------ */

function renderSection(section: HomeSection) {
  let cfg: any = {}
  try {
    cfg = typeof section.config === "string" ? JSON.parse(section.config) : (section.config || {})
  } catch { cfg = {} }

  switch (section.type) {
    case "announcement":
      return <AnnouncementBar key={section.id} />

    case "hero_carousel":
      return <HeroBannerCarousel key={section.id} />

    case "category_icons":
      return <CategoryIconStrip key={section.id} />

    case "top_selling":
      return (
        <TopSellingSection
          key={section.id}
          sectionId={section.id}
          title={section.title || `Top Selling ${section.category?.name || "Products"}`}
          categoryId={section.categoryId || section.category?.id || ""}
          categoryHandle={section.category?.handle}
          limit={cfg.limit || 8}
          productIds={cfg.productIds}
        />
      )

    case "trust_badges":
      return <TrustBadgesSection key={section.id} items={cfg.items} />

    case "promotional":
      return <MidPromotionalBanner key={section.id} />

    case "shop_by_category":
      return <ShopByCategoryGrid key={section.id} columns={cfg.columns || 4} />

    case "cta":
      return (
        <CTABannerSection
          key={section.id}
          headline={cfg.headline || section.title || undefined}
          subtext={cfg.subtext || section.subtitle || undefined}
          ctaText={cfg.ctaText}
          ctaLink={cfg.ctaLink}
          ctaText2={cfg.ctaText2}
          ctaLink2={cfg.ctaLink2}
        />
      )

    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/*  Main Home Page                                                     */
/* ------------------------------------------------------------------ */

export default function Home() {
  const siteName = useSetting("siteName", "WholesaleX Pro")

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [homeSections, setHomeSections] = useState<HomeSection[]>([])
  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const { user } = useAuth()

  // Dynamic rules
  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId, unitPrice: Number(p.unitPrice) })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts } = useStorefrontRules(rulesProducts)

  const ruleDiscountMap = useMemo(() => {
    const m = new Map<string, { discountPercent: number; discountAmount: number; ruleName: string }>()
    for (const d of productDiscounts) m.set(d.productId, d)
    return m
  }, [productDiscounts])

  const bogoMap = useMemo(() => {
    const m = new Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>()
    for (const b of bogo) { const arr = m.get(b.buyProductId) || []; arr.push(b); m.set(b.buyProductId, arr) }
    return m
  }, [bogo])

  const qtyDiscountMap = useMemo(() => {
    const m = new Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>()
    for (const qd of quantityDiscounts) { if (qd.productId) m.set(qd.productId, qd) }
    return m
  }, [quantityDiscounts])

  const rolePricingProducts = useMemo(() => products.map((p) => ({ id: p.id, unitPrice: Number(p.unitPrice) })), [products])
  const { pricing: rolePricingMap } = useRolePricing(rolePricingProducts)

  useEffect(() => {
    Promise.all([
      fetch("/api/products?limit=12").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetchSeasonalDiscounts(),
      fetch("/api/home-sections").then((r) => r.json()).catch(() => []),
    ]).then(([pData, cData, activeDiscounts, sectionsData]) => {
      setProducts(pData.products || [])
      setDiscounts(activeDiscounts)
      const cats: Category[] = cData.categories || []
      setCategories(cats)
      const sectionList = Array.isArray(sectionsData)
        ? sectionsData
        : sectionsData?.sections || sectionsData?.data || []
      setHomeSections(sectionList)
      setSectionsLoaded(true)
    }).catch(() => setSectionsLoaded(true))
  }, [])

  const handleAddToCart = async (productId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    await fetch("/api/cart", { method: "POST", headers, body: JSON.stringify({ productId, quantity: 1 }) })
    window.dispatchEvent(new CustomEvent("cart-updated"))
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: typeof window !== "undefined" ? window.location.origin : "https://wholesalex.com",
    description: "India's trusted B2B wholesale marketplace. Buy bulk products at the best prices with tier pricing, contract deals, and fast shipping across India.",
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", availableLanguage: "English" },
  }

  const visibleProducts = products.filter((p) => !hiddenProductIds.has(p.id))

  // Decide whether to use dynamic sections or default layout
  const hasSections = sectionsLoaded && homeSections.length > 0

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gray-50">

        {/* ── Announcement Bar ── */}
        <AnnouncementBar />

        {hasSections ? (
          /* ── Dynamic section layout from admin config ── */
          <>
            {homeSections
              .filter((s) => s.isActive !== false)
              .sort((a, b) => a.rank - b.rank)
              .map((section) => renderSection(section))}
          </>
        ) : (
          /* ── Default Lotus Electronics-style layout ── */
          <>

            {/* ── Hero Banner Carousel (or fallback hero) ── */}
            <HeroBannerCarousel />
            <DefaultHeroFallback products={products} visibleProducts={visibleProducts} discounts={discounts} hiddenPriceProductIds={hiddenPriceProductIds} nonPurchasableProducts={nonPurchasableProducts} ruleDiscountMap={ruleDiscountMap} bogoMap={bogoMap} qtyDiscountMap={qtyDiscountMap} rolePricingMap={rolePricingMap} handleAddToCart={handleAddToCart} />

            {/* ── Category Icons Strip ── */}
            <CategoryIconStrip />

            {/* ── Top Selling per category ── */}
            {categories.map((cat) => (
              <TopSellingSection
                key={cat.id}
                sectionId={`default-${cat.id}`}
                title={`Top Selling ${cat.name}`}
                categoryId={cat.id}
                categoryHandle={cat.handle}
                limit={8}
              />
            ))}

            {/* ── Mid-Page Promotional Banner ── */}
            <MidPromotionalBanner />

            {/* ── Trust Badges ── */}
            <TrustBadgesSection />

            {/* ── Shop by Category ── */}
            <ShopByCategoryGrid />

            {/* ── CTA Banner ── */}
            <CTABannerSection />
          </>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Default Hero Fallback                                              */
/*  Shown only when no hero banners exist in the carousel             */
/* ------------------------------------------------------------------ */

function DefaultHeroFallback({
  products,
  visibleProducts,
  discounts,
  hiddenPriceProductIds,
  nonPurchasableProducts,
  ruleDiscountMap,
  bogoMap,
  qtyDiscountMap,
  rolePricingMap,
  handleAddToCart,
}: {
  products: Product[]
  visibleProducts: Product[]
  discounts: SeasonalDiscount[]
  hiddenPriceProductIds: Set<string>
  nonPurchasableProducts: Map<string, string>
  ruleDiscountMap: Map<string, { discountPercent: number; discountAmount: number; ruleName: string }>
  bogoMap: Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>
  qtyDiscountMap: Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>
  rolePricingMap: Record<string, any>
  handleAddToCart: (id: string) => void
}) {
  const heroHeadline = useSetting("heroHeadline", "Bulk Orders. Best Prices. Delivered.")
  const heroSubtext = useSetting("heroSubtext", "Connect with top vendors, get tier pricing, request quotes, and manage your wholesale procurement — all in one platform.")
  const heroCtaText = useSetting("heroCtaText", "Browse Products")

  if (visibleProducts.length === 0) return null

  return (
    <section className="py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{heroHeadline}</h2>
            <p className="text-gray-500 text-sm mt-1">{heroSubtext}</p>
          </div>
          <Link href="/products" className="hidden sm:flex items-center gap-1 text-primary-600 font-semibold hover:gap-2 transition-all text-sm">
            View All <ArrowRight size={16} />
          </Link>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          {visibleProducts.slice(0, 12).map((product) => {
            const isPriceHidden = hiddenPriceProductIds.has(product.id)
            const isNonPurchasable = nonPurchasableProducts.has(product.id)
            const rp = rolePricingMap[product.id]
            const ruleDisc = ruleDiscountMap.get(product.id)
            const productBogo = bogoMap.get(product.id)
            const productQtyDisc = qtyDiscountMap.get(product.id)
            const disc = getProductDiscount(discounts, product.id, product.categoryId || undefined)

            return (
              <Link
                key={product.id}
                href={`/products/${product.handle}`}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="relative h-28 sm:h-36 bg-gray-100">
                  {product.thumbnail || product.images?.[0] ? (
                    <img src={product.thumbnail || product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                  )}
                  {disc && <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-semibold rounded">{discountBadge(disc)}</span>}
                  {product.tierPrices?.length > 0 && <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-semibold rounded">Bulk</span>}
                </div>
                <div className="p-2.5">
                  <h3 className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-1 group-hover:text-primary-600 transition">{product.title}</h3>
                  {product.rating > 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] text-gray-500">{product.rating}</span>
                    </div>
                  )}
                  <div className="mt-1">
                    {isPriceHidden ? (
                      <span className="text-xs text-gray-500 italic">Login for price</span>
                    ) : rp ? (
                      <div>
                        <span className="font-bold text-primary-700 text-sm">{formatPrice(rp.rolePrice)}</span>
                        <span className="text-[10px] text-gray-400 line-through ml-1">{formatPrice(product.unitPrice)}</span>
                      </div>
                    ) : ruleDisc ? (
                      <div>
                        <span className="font-bold text-primary-700 text-sm">{formatPrice(Number(product.unitPrice) - ruleDisc.discountAmount)}</span>
                        <span className="text-[10px] text-gray-400 line-through ml-1">{formatPrice(product.unitPrice)}</span>
                      </div>
                    ) : product.tierPrices?.length > 0 ? (
                      <div>
                        <span className="text-[10px] text-green-600 font-semibold">From </span>
                        <span className="font-bold text-gray-900 text-sm">{formatPrice(Number(product.tierPrices[product.tierPrices.length - 1].price))}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-gray-900 text-sm">{formatPrice(product.unitPrice)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    <ProductRuleBadge
                      priceHidden={isPriceHidden}
                      nonPurchasable={isNonPurchasable}
                      hasRolePrice={!!rp}
                      roleLabel={rp?.appliedRoleName || undefined}
                      bogoLabel={productBogo ? `Buy ${productBogo[0].buyQuantity} Get ${productBogo[0].freeQuantity} Free` : undefined}
                      quantityDiscountLabel={productQtyDisc ? productQtyDisc.ruleName : undefined}
                      discountLabel={ruleDisc?.ruleName}
                      discountPercent={ruleDisc?.discountPercent}
                      size="sm"
                    />
                  </div>
                  {!isNonPurchasable && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleAddToCart(product.id) }}
                      className="mt-1.5 w-full py-1 bg-primary-600 text-white rounded-lg text-[11px] font-medium hover:bg-primary-700 transition"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <Link href="/products" className="sm:hidden flex items-center justify-center gap-1 text-primary-600 font-semibold mt-4 text-sm">
          View All Products <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}