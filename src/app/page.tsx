"use client"

import { useMemo } from "react"

import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { useCategories } from "@/lib/categories/CategoriesProvider"

// Home section components
import AnnouncementBar from "@/components/home/AnnouncementBar"
import HeroBannerCarousel from "@/components/home/HeroBannerCarousel"
import ShopByCategoryGrid from "@/components/home/ShopByCategoryGrid"
import HomeProductsSection from "@/components/home/HomeProductsSection"
import CTABannerSection from "@/components/home/CTABannerSection"
import TrustBadgesSection from "@/components/home/TrustBadgesSection"

const TOP_CATEGORY_COUNT = 5

/**
 * Home page, top to bottom: hero banner → shop-by-category strip → top 10 best-selling products
 * (2 rows of 5) → the 5 biggest categories, each with up to 10 of its best sellers (2 rows of 5)
 * and a "view all products" button → bulk-order banner → why choose us.
 * All colours come from the theme's primary colour (Admin → Settings), nothing is hard-coded.
 */
export default function Home() {
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const { categories } = useCategories()

  // The categories with the most products (top level only), empty ones skipped.
  const topCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => (c._count?.products ?? 0) > 0)
        .sort((a, b) => (b._count?.products ?? 0) - (a._count?.products ?? 0))
        .slice(0, TOP_CATEGORY_COUNT),
    [categories]
  )

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: "https://wholesalex.com",
    description: "India's trusted B2B wholesale marketplace. Buy bulk products at the best prices with tier pricing, contract deals, and fast shipping across India.",
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", availableLanguage: "English" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-white">
        <AnnouncementBar />

        {/* Hero banner — rounded panel inside the page width */}
        <div className="section-container pt-4">
          <div className="overflow-hidden rounded-3xl">
            <HeroBannerCarousel heightClass="h-[300px] sm:h-[340px] lg:h-[380px]" />
          </div>
        </div>

        <ShopByCategoryGrid />

        {/* Top 10 best sellers, 2 rows of 5 */}
        <HomeProductsSection
          title="Top Selling Products"
          subtitle="High-demand products trusted by businesses nationwide."
          query="sort=bestselling&limit=10"
          viewAllHref="/products"
          viewAllLabel="View All Products"
          tone="tint"
        />

        {/* The 5 biggest categories, each with its own best sellers */}
        {topCategories.map((cat) => (
          <HomeProductsSection
            key={cat.id}
            title={cat.name}
            subtitle={`${cat._count?.products ?? 0} products in ${cat.name}`}
            query={`category=${cat.id}&sort=bestselling&limit=10`}
            viewAllHref={`/categories/${cat.handle}`}
            viewAllLabel="View all products"
          />
        ))}

        <div className="section-container py-4 sm:py-6">
          <CTABannerSection />
        </div>

        <TrustBadgesSection />
      </div>
    </>
  )
}
