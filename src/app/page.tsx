"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Zap, Clock } from "lucide-react"

import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { useCategories } from "@/lib/categories/CategoriesProvider"
import { getCartSessionId } from "@/lib/utils"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount } from "@/lib/pricing"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"
import { ProductCarousel } from "@/components/ui/ProductCarousel"
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton"

// Home section components
import AnnouncementBar from "@/components/home/AnnouncementBar"
import HeroBannerCarousel from "@/components/home/HeroBannerCarousel"
import TopSellingSection from "@/components/home/TopSellingSection"
import TrustBadgesSection from "@/components/home/TrustBadgesSection"
import MidPromotionalBanner from "@/components/home/MidPromotionalBanner"
import ShopByCategoryGrid from "@/components/home/ShopByCategoryGrid"
import CTABannerSection from "@/components/home/CTABannerSection"
import NewsletterSection from "@/components/home/NewsletterSection"

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

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SectionConfig {
  limit?: number
  productIds?: string[]
  columns?: number
  items?: { icon: string; title: string; desc: string }[]
  text?: string
  color?: string
  bgColor?: string
  imageUrl?: string
  linkUrl?: string
  headline?: string
  subtext?: string
  ctaText?: string
  ctaLink?: string
  ctaText2?: string
  ctaLink2?: string
  [key: string]: unknown
}

interface HomeSection {
  id: string
  type: string
  title: string | null
  subtitle: string | null
  config: SectionConfig
  rank: number
  isActive: boolean
  categoryId: string | null
  category: { id: string; name: string; handle: string } | null
}

/* ------------------------------------------------------------------ */
/*  Section type → component mapper                                    */
/* ------------------------------------------------------------------ */

function renderSection(section: HomeSection) {
  let cfg: SectionConfig = {}
  try {
    cfg = typeof section.config === "string" ? JSON.parse(section.config) : (section.config || {})
  } catch (e) { console.error("Failed to parse section config:", e); cfg = {} }

  switch (section.type) {
    case "announcement":
      return <AnnouncementBar key={section.id} />

    case "hero_carousel":
      return <HeroBannerCarousel key={section.id} />

    case "category_icons":
      return null

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

    case "newsletter":
      return <NewsletterSection key={section.id} />

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
  const { categories } = useCategories()
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])
  const [homeSections, setHomeSections] = useState<HomeSection[]>([])
  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const { user } = useAuth()
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()

  // Dynamic rules
  const rulesProducts = useMemo(() => products.map((p) => ({ id: p.id, categoryId: p.categoryId, unitPrice: Number(p.unitPrice) })), [products])
  const { hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts, productDiscounts, bogo, quantityDiscounts, customBadges } = useStorefrontRules(rulesProducts)

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
      fetchSeasonalDiscounts(),
      fetch("/api/home-sections").then((r) => r.json()).catch(() => []),
    ]).then(([pData, activeDiscounts, sectionsData]) => {
      setProducts(pData.products || [])
      setDiscounts(activeDiscounts)
      const sectionList = Array.isArray(sectionsData)
        ? sectionsData
        : sectionsData?.sections || sectionsData?.data || []
      setHomeSections(sectionList)
      setSectionsLoaded(true)
    }).catch(() => setSectionsLoaded(true))
  }, [])

  const handleAddToCart = async (productId: string, qty: number) => {
    setAddingId(productId)
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
    if (token) headers["Authorization"] = `Bearer ${token}`
    try {
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
      setAddingId(null)
    }
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
      <div className="min-h-screen bg-white">

        {hasSections ? (
          /* ── Dynamic section layout from admin config ── */
          <>
            {/* ── Announcement Bar: show at top only if no announcement section exists in sections ── */}
            {!homeSections.filter((s) => s.isActive !== false).some((s) => s.type === "announcement") && <AnnouncementBar />}
            {homeSections
              .filter((s) => s.isActive !== false)
              .sort((a, b) => a.rank - b.rank)
              .map((section) => renderSection(section))}
          </>
        ) : (
          /* ── Default layout ── */
          <>
            <AnnouncementBar />

            {/* ── Hero Banner Carousel (or fallback hero) ── */}
            <HeroBannerCarousel />
            {!sectionsLoaded ? (
              <section className="section-padding-tight">
                <div className="section-container">
                  <ProductGridSkeleton count={8} />
                </div>
              </section>
            ) : (
              <DefaultHeroFallback
                products={products}
                visibleProducts={visibleProducts}
                discounts={discounts}
                hiddenPriceProductIds={hiddenPriceProductIds}
                nonPurchasableProducts={nonPurchasableProducts}
                ruleDiscountMap={ruleDiscountMap}
                bogoMap={bogoMap}
                qtyDiscountMap={qtyDiscountMap}
                rolePricingMap={rolePricingMap}
                customBadges={customBadges}
                addingId={addingId}
                handleAddToCart={handleAddToCart}
              />
            )}

            {/* ── Deals of the Day ── */}
            {sectionsLoaded && (
              <DealsOfTheDaySection
                products={visibleProducts}
                discounts={discounts}
                hiddenPriceProductIds={hiddenPriceProductIds}
                nonPurchasableProducts={nonPurchasableProducts}
                ruleDiscountMap={ruleDiscountMap}
                bogoMap={bogoMap}
                qtyDiscountMap={qtyDiscountMap}
                rolePricingMap={rolePricingMap}
                customBadges={customBadges}
                addingId={addingId}
                handleAddToCart={handleAddToCart}
              />
            )}

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

            {/* ── Shop by Category ── */}
            <ShopByCategoryGrid />

            {/* ── Trust Badges / Why Choose Us ── */}
            <TrustBadgesSection />

            {/* ── Newsletter ── */}
            <NewsletterSection />
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
  customBadges,
  addingId,
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
  rolePricingMap: Record<string, { rolePrice: number; appliedRoleName: string | null; savings: number; savingsPercent: number; finalPrice: number }>
  customBadges: { productId: string; badgeLabel: string; badgeColor: string | null; ruleName: string }[]
  addingId: string | null
  handleAddToCart: (id: string, qty: number) => void
}) {
  const heroHeadline = useSetting("heroHeadline", "Bulk Orders. Best Prices. Delivered.")
  const heroSubtext = useSetting("heroSubtext", "Connect with top vendors, get tier pricing, request quotes, and manage your wholesale procurement — all in one platform.")
  const heroCtaText = useSetting("heroCtaText", "Browse Products")

  if (visibleProducts.length === 0) return null

  return (
    <section className="section-padding-tight">
      <div className="section-container">
        {/* Section header */}
        <div className="section-header">
          <div>
            <span className="eyebrow">Featured</span>
            <h2 className="heading-lg">{heroHeadline}</h2>
            <p className="body-sm mt-1.5">{heroSubtext}</p>
          </div>
          <Link href="/products" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-all duration-200">
            View All <ArrowRight size={16} />
          </Link>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {visibleProducts.slice(0, 12).map((product) => (
            <ProductCard
              key={product.id}
              product={{ ...product, thumbnail: product.thumbnail || product.images?.[0] || null }}
              view="grid"
              isPriceHidden={hiddenPriceProductIds.has(product.id)}
              isNonPurchasable={nonPurchasableProducts.has(product.id)}
              nonPurchasableMsg={nonPurchasableProducts.get(product.id) || ""}
              rolePricing={rolePricingMap[product.id]}
              ruleDiscount={ruleDiscountMap.get(product.id)}
              bogo={bogoMap.get(product.id)}
              quantityDiscount={qtyDiscountMap.get(product.id)}
              customBadges={customBadges}
              seasonalDiscount={getProductDiscount(discounts, product.id, product.categoryId || undefined)}
              isAdding={addingId === product.id}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>

        <Link href="/products" className="sm:hidden flex items-center justify-center gap-1.5 text-primary-600 font-semibold mt-5 text-sm">
          View All Products <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Deals of the Day                                                   */
/*  Top-discounted products with a live countdown, Flipkart-style      */
/* ------------------------------------------------------------------ */

function DealsOfTheDaySection({
  products,
  discounts,
  hiddenPriceProductIds,
  nonPurchasableProducts,
  ruleDiscountMap,
  bogoMap,
  qtyDiscountMap,
  rolePricingMap,
  customBadges,
  addingId,
  handleAddToCart,
}: {
  products: Product[]
  discounts: SeasonalDiscount[]
  hiddenPriceProductIds: Set<string>
  nonPurchasableProducts: Map<string, string>
  ruleDiscountMap: Map<string, { discountPercent: number; discountAmount: number; ruleName: string }>
  bogoMap: Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>
  qtyDiscountMap: Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>
  rolePricingMap: Record<string, { rolePrice: number; appliedRoleName: string | null; savings: number; savingsPercent: number; finalPrice: number }>
  customBadges: { productId: string; badgeLabel: string; badgeColor: string | null; ruleName: string }[]
  addingId: string | null
  handleAddToCart: (id: string, qty: number) => void
}) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const dealProducts = useMemo(() => {
    return products
      .filter((p) => p.compareAtPrice && Number(p.compareAtPrice) > Number(p.unitPrice))
      .sort((a, b) => {
        const da = (Number(a.compareAtPrice) - Number(a.unitPrice)) / Number(a.compareAtPrice)
        const db = (Number(b.compareAtPrice) - Number(b.unitPrice)) / Number(b.compareAtPrice)
        return db - da
      })
      .slice(0, 10)
  }, [products])

  if (dealProducts.length === 0) return null

  return (
    <section className="section-padding-tight bg-gradient-to-b from-amber-50/70 to-transparent">
      <div className="section-container">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-400 text-amber-900 shadow-sm shrink-0">
              <Zap size={20} fill="currentColor" />
            </span>
            <div>
              <h2 className="heading-lg">Deals of the Day</h2>
              <p className="body-sm mt-0.5">Grab these offers before they&apos;re gone</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-mono text-sm font-bold tracking-wider shadow-sm">
            <Clock size={15} className="text-amber-400" />
            {timeLeft || "--:--:--"} <span className="text-white/60 font-sans font-normal">left</span>
          </div>
        </div>
        <ProductCarousel
          items={dealProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={{ ...product, thumbnail: product.thumbnail || product.images?.[0] || null }}
              view="grid"
              isPriceHidden={hiddenPriceProductIds.has(product.id)}
              isNonPurchasable={nonPurchasableProducts.has(product.id)}
              nonPurchasableMsg={nonPurchasableProducts.get(product.id) || ""}
              rolePricing={rolePricingMap[product.id]}
              ruleDiscount={ruleDiscountMap.get(product.id)}
              bogo={bogoMap.get(product.id)}
              quantityDiscount={qtyDiscountMap.get(product.id)}
              customBadges={customBadges}
              seasonalDiscount={getProductDiscount(discounts, product.id, product.categoryId || undefined)}
              isAdding={addingId === product.id}
              onAddToCart={handleAddToCart}
            />
          ))}
        />
      </div>
    </section>
  )
}
