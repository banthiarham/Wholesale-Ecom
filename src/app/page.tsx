"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { getCartSessionId } from "@/lib/utils"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount } from "@/lib/pricing"
import { useAuth } from "@/lib/auth"
import { useStorefrontRules } from "@/lib/rules"
import { useRolePricing } from "@/lib/pricing/useRolePricing"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { ProductCard } from "@/components/ui/ProductCard"
import { ProductCarousel } from "@/components/ui/ProductCarousel"

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
    url: "https://wholesalex.com",
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
              .map((section) => (
                <div key={section.id}>
                  {renderSection(section)}
                  {section.type === "shop_by_category" && (
                    <HomepageTopSelling products={visibleProducts} discounts={discounts} hiddenPriceProductIds={hiddenPriceProductIds} nonPurchasableProducts={nonPurchasableProducts} ruleDiscountMap={ruleDiscountMap} bogoMap={bogoMap} qtyDiscountMap={qtyDiscountMap} rolePricingMap={rolePricingMap} customBadges={customBadges} addingId={addingId} handleAddToCart={handleAddToCart} />
                  )}
                </div>
              ))}
          </>
        ) : (
          /* ── Default layout ── */
          <>
            <AnnouncementBar />

            {/* ── Hero Banner Carousel (or fallback hero) ── */}
            <HeroBannerCarousel />

            {/* ── Shop by Category ── */}
            <ShopByCategoryGrid />

            <HomepageTopSelling
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

            <div className="section-container py-4 sm:py-6"><CTABannerSection headline="Ready to Buy in Bulk?" subtext="Get the best wholesale prices with tier discounts and reliable delivery." ctaText="Browse Products" ctaLink="/products" /></div>

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

function HomepageTopSelling({ products, discounts, hiddenPriceProductIds, nonPurchasableProducts, ruleDiscountMap, bogoMap, qtyDiscountMap, rolePricingMap, customBadges, addingId, handleAddToCart }: {
  products: Product[]; discounts: SeasonalDiscount[]; hiddenPriceProductIds: Set<string>; nonPurchasableProducts: Map<string,string>
  ruleDiscountMap: Map<string,{discountPercent:number;discountAmount:number;ruleName:string}>; bogoMap: Map<string,{buyQuantity:number;freeProductId:string;freeQuantity:number;ruleName:string}[]>
  qtyDiscountMap: Map<string,{tiers:{minQty:number;discountType:string;discountValue:number}[];ruleName:string}>; rolePricingMap: Record<string,{rolePrice:number;appliedRoleName:string|null;savings:number;savingsPercent:number;finalPrice:number}>
  customBadges:{productId:string;badgeLabel:string;badgeColor:string|null;ruleName:string}[]; addingId:string|null; handleAddToCart:(id:string,qty:number)=>void
}) {
  if (!products.length) return null
  return <section className="section-padding-tight bg-white"><div className="section-container">
    <div className="section-header pr-24"><div><h2 className="heading-lg">Top Selling Products</h2><p className="body-sm mt-1.5">High-demand products trusted by businesses nationwide.</p></div><Link href="/products" className="hidden items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 lg:inline-flex">View All Products <ArrowRight size={16}/></Link></div>
    <ProductCarousel items={products.slice(0,12).map(product=><ProductCard key={product.id} product={{...product,thumbnail:product.thumbnail||product.images?.[0]||null}} view="grid" isPriceHidden={hiddenPriceProductIds.has(product.id)} isNonPurchasable={nonPurchasableProducts.has(product.id)} nonPurchasableMsg={nonPurchasableProducts.get(product.id)||""} rolePricing={rolePricingMap[product.id]} ruleDiscount={ruleDiscountMap.get(product.id)} bogo={bogoMap.get(product.id)} quantityDiscount={qtyDiscountMap.get(product.id)} customBadges={customBadges} seasonalDiscount={getProductDiscount(discounts,product.id,product.categoryId)} isAdding={addingId===product.id} onAddToCart={handleAddToCart}/>)}/>
  </div></section>
}
