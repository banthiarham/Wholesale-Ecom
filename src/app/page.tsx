"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import CategoryNav from "@/components/categories/CategoryNav"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { SeasonalDiscount, fetchSeasonalDiscounts, getProductDiscount, discountBadge } from "@/lib/pricing"
import {
  ShoppingCart,
  Tag,
  FileText,
  ShieldCheck,
  Truck,
  IndianRupee,
  Star,
  ArrowRight,
  Package,
  Users,
  BarChart3,
  ChevronRight,
  Flame,
} from "lucide-react"

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
  category: { name: string; handle: string }
  inventoryQuantity: number
  tierPrices: TierPrice[]
  categoryId?: string
}

export default function Home() {
  const { t } = useTranslation()
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const heroHeadline = useSetting("heroHeadline", "Bulk Orders. Best Prices. Delivered.")
  const heroSubtext = useSetting("heroSubtext", "Connect with top vendors, get tier pricing, request quotes, and manage your wholesale procurement — all in one platform.")
  const heroCtaText = useSetting("heroCtaText", "Browse Products")
  const heroBannerUrl = useSetting("heroBannerUrl", "")
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState({ products: 0, categories: 0, vendors: 0 })
  const [discounts, setDiscounts] = useState<SeasonalDiscount[]>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/products?limit=8").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetchSeasonalDiscounts(),
    ]).then(([pData, cData, activeDiscounts]) => {
      setProducts(pData.products || [])
      setDiscounts(activeDiscounts)
      const cats = cData.categories || []
      const vendorSet = new Set((pData.products || []).map((p: Product) => p.vendorName))
      setStats({
        products: pData.count || pData.products?.length || 0,
        categories: cats.length,
        vendors: vendorSet.size,
      })
    })
  }, [])

  const handleAddToCart = async (productId: string) => {
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() },
      body: JSON.stringify({ productId, quantity: 1 }),
    })
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-primary-700 via-primary-600 to-blue-500 overflow-hidden">
        {heroBannerUrl && (
          <img src={heroBannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className={`absolute inset-0 ${heroBannerUrl ? "bg-black/50" : "opacity-10"}`}>
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl animate-fade-in-up">
            <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 text-white rounded-full mb-6 tracking-wide uppercase">
              B2B Wholesale Platform
            </span>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              {heroHeadline.split(".").map((line, i, arr) => (
                <span key={i}>
                  {line.trim()}{i < arr.length - 1 ? "." : ""}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="text-lg text-blue-100 mb-10 max-w-lg">
              {heroSubtext}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/products"
                className="px-8 py-3.5 bg-white text-primary-700 font-semibold rounded-lg hover:bg-blue-50 transition shadow-lg"
              >
                {heroCtaText}
              </Link>
              <Link
                href="/rfqs/new"
                className="px-8 py-3.5 bg-white/10 backdrop-blur text-white font-semibold rounded-lg border border-white/30 hover:bg-white/20 transition"
              >
                Request a Quote
              </Link>
            </div>
          </div>

          {/* Stats strip inside hero */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 animate-fade-in-up-delay-2">
            {[
              { value: stats.products, label: "Products", icon: Package },
              { value: stats.categories, label: "Categories", icon: BarChart3 },
              { value: stats.vendors, label: "Vendors", icon: Users },
              { value: "5L+", label: "Orders Fulfilled", icon: IndianRupee },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-5 py-4"
              >
                <s.icon size={22} className="text-blue-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-blue-200">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How {siteName} Works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Three simple steps to streamline your bulk procurement</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Tag,
                title: "Browse & Compare",
                desc: "Explore thousands of products across categories. Compare prices, MOQs, and vendor ratings side by side.",
              },
              {
                step: "02",
                icon: FileText,
                title: "Order or Request Quote",
                desc: "Place bulk orders directly with tier pricing, or send an RFQ to negotiate custom deals with vendors.",
              },
              {
                step: "03",
                icon: ShieldCheck,
                title: "Secure Checkout & Delivery",
                desc: "Pay securely via CCAvenue or COD. Track your orders in real-time with guaranteed delivery.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative bg-gray-50 rounded-2xl p-8 hover:shadow-lg hover:bg-white transition group"
              >
                <span className="text-5xl font-extrabold text-primary-100 group-hover:text-primary-200 transition absolute top-6 right-8">
                  {item.step}
                </span>
                <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mb-5">
                  <item.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Products ── */}
      {products.length > 0 && (
        <section className="py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1">Featured Products</h2>
                <p className="text-gray-500">Top picks from verified vendors</p>
              </div>
              <Link
                href="/products"
                className="hidden sm:flex items-center gap-1 text-primary-600 font-semibold hover:gap-2 transition-all"
              >
                View All <ArrowRight size={18} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.handle}`}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group"
                >
                  <div className="relative h-48 bg-gray-100">
                    {product.thumbnail || product.images?.[0] ? (
                      <img
                        src={product.thumbnail || product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={40} className="text-gray-300" />
                      </div>
                    )}
                    {(() => {
                      const disc = getProductDiscount(discounts, product.id, product.categoryId || undefined)
                      const compareOff = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice)
                        ? Math.round(((Number(product.compareAtPrice) - Number(product.unitPrice)) / Number(product.compareAtPrice)) * 100)
                        : 0
                      if (disc) return <span className="absolute top-3 left-3 px-2 py-0.5 bg-orange-500 text-white text-xs font-semibold rounded flex items-center gap-1"><Flame size={10} />{disc.name} · {discountBadge(disc)}</span>
                      if (compareOff) return <span className="absolute top-3 left-3 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded">{compareOff}% OFF</span>
                      return null
                    })()}
                    <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                      MOQ: {product.moq}
                    </span>
                    {product.tierPrices && product.tierPrices.length > 0 && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">
                        Bulk Pricing
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-400 mb-1">{product.category?.name}</p>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{product.title}</h3>
                    <p className="text-xs text-gray-400 mb-2">{product.vendorName}</p>
                    <div className="flex items-center gap-1 mb-3">
                      {product.rating > 0 && (
                        <>
                          <Star size={14} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs text-gray-600">{product.rating}</span>
                          <span className="text-xs text-gray-400">({product.reviewCount})</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        {product.tierPrices && product.tierPrices.length > 0 ? (
                          <>
                            <span className="text-xs text-green-600 font-semibold">Starting from</span>
                            <div>
                              <span className="text-lg font-bold text-gray-900">{formatPrice(product.tierPrices[product.tierPrices.length - 1].price)}</span>
                              <span className="text-sm text-gray-400 line-through ml-1">{formatPrice(product.unitPrice)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-lg font-bold text-gray-900">{formatPrice(product.unitPrice)}</span>
                            {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.unitPrice) && (
                              <span className="text-sm text-gray-400 line-through ml-2">{formatPrice(product.compareAtPrice)}</span>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); handleAddToCart(product.id) }}
                        className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition"
                      >
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/products"
              className="sm:hidden flex items-center justify-center gap-1 text-primary-600 font-semibold mt-6"
            >
              View All Products <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}

      {/* ── Current Deals ── */}
      {discounts.length > 0 && (
        <section className="bg-gradient-to-r from-orange-50 to-red-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Flame size={24} className="text-orange-500" />
                  <h2 className="text-2xl font-bold text-gray-900">Current Deals</h2>
                </div>
                <p className="text-gray-500">Limited-time offers and seasonal discounts</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discounts.slice(0, 6).map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-orange-100 p-5 hover:shadow-md transition">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                      {d.type === "PERCENTAGE" ? `${d.value}% OFF` : `₹${d.value.toLocaleString("en-IN")} OFF`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {d.product ? d.product.title : d.category ? d.category.name : "All Products"}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{d.name}</h3>
                  {d.minQty && <p className="text-xs text-gray-500 mt-1">Min. {d.minQty} qty</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Valid until {new Date(d.endDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Why Choose Us / Trust Banner ── */}
      <section className="bg-gray-900 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Why Businesses Choose {siteName}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Built for serious bulk buyers and trusted vendors</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: IndianRupee,
                title: "Tier Pricing",
                desc: "Buy more, save more. Automatic volume discounts on every product.",
              },
              {
                icon: FileText,
                title: "RFQ System",
                desc: "Negotiate custom deals. Send RFQs and get quotes from multiple vendors.",
              },
              {
                icon: Truck,
                title: "Reliable Delivery",
                desc: "Track orders in real-time. Guaranteed fulfillment with verified vendors.",
              },
              {
                icon: ShieldCheck,
                title: "Secure Payments",
                desc: "CCAvenue integration for safe transactions. COD also available.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                <div className="w-14 h-14 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <item.icon size={24} className="text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shop by Category ── */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1">{t("home.categories")}</h2>
              <p className="text-gray-500">Browse products by industry</p>
            </div>
            <Link
              href="/categories"
              className="hidden sm:flex items-center gap-1 text-primary-600 font-semibold hover:gap-2 transition-all"
            >
              All Categories <ChevronRight size={18} />
            </Link>
          </div>
          <CategoryNav />
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-gradient-to-r from-primary-700 to-blue-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Ready to buy in bulk?</h2>
            <p className="text-blue-100">Sign up for free and get access to exclusive wholesale pricing today.</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-white text-primary-700 font-semibold rounded-lg hover:bg-blue-50 transition shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/rfqs/new"
              className="px-8 py-3.5 bg-white/10 backdrop-blur text-white font-semibold rounded-lg border border-white/30 hover:bg-white/20 transition"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </section>
    </div>
    </>
  )
}