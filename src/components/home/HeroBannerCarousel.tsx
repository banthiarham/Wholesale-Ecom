"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight, ArrowRight, Zap, ShieldCheck, Truck } from "lucide-react"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"

interface Banner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  linkUrl: string | null
  buttonText: string | null
  section: string
}

const FALLBACK_HEROES = [
  {
    title: "Bulk Orders. Best Prices.",
    subtitle: "India's trusted B2B wholesale marketplace. Get exclusive tier pricing, contract deals, and fast shipping across India.",
    gradient: "from-primary-700 via-primary-600 to-blue-500",
    icon: Zap,
    cta: "Browse Products",
    link: "/products",
  },
  {
    title: "Genuine Products Guaranteed",
    subtitle: "Shop from verified vendors with 100% authentic products. Quality assured with easy returns.",
    gradient: "from-emerald-700 via-emerald-600 to-teal-500",
    icon: ShieldCheck,
    cta: "View Categories",
    link: "/categories",
  },
  {
    title: "Fast & Reliable Delivery",
    subtitle: "From warehouse to your doorstep. Pan-India delivery with real-time tracking on every order.",
    gradient: "from-blue-700 via-blue-600 to-indigo-500",
    icon: Truck,
    cta: "Start Ordering",
    link: "/products",
  },
]

export default function HeroBannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [current, setCurrent] = useState(0)
  const autoplay = useSetting("heroCarouselAutoplay", "true") === "true"
  const speed = Number(useSetting("heroCarouselSpeed", "5000"))

  useEffect(() => {
    fetch("/api/banners?section=hero")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.banners || []
        setBanners(list)
      })
      .catch((err) => { console.error("Failed to fetch hero banners:", err) })
  }, [])

  const next = useCallback(() => {
    const len = banners.length > 0 ? banners.length : FALLBACK_HEROES.length
    setCurrent((prev) => (prev + 1) % Math.max(len, 1))
  }, [banners.length])

  const prev = useCallback(() => {
    const len = banners.length > 0 ? banners.length : FALLBACK_HEROES.length
    setCurrent((prev) => (prev - 1 + len) % Math.max(len, 1))
  }, [banners.length])

  useEffect(() => {
    const len = banners.length > 0 ? banners.length : FALLBACK_HEROES.length
    if (!autoplay || len <= 1) return
    const timer = setInterval(next, speed || 5000)
    return () => clearInterval(timer)
  }, [autoplay, speed, next, banners.length])

  // Show fallback heroes when no banners exist
  if (banners.length === 0) {
    return (
      <section className="relative overflow-hidden">
        <div className="relative h-[420px] sm:h-[480px] lg:h-[560px]">
          {FALLBACK_HEROES.map((hero, index) => {
            const Icon = hero.icon
            return (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-700 ease-in-out bg-gradient-to-br ${hero.gradient} ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
              >
                {/* Decorative shapes */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-white/[0.07] rounded-full" />
                  <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/[0.05] rounded-full translate-y-1/3 -translate-x-1/4" />
                  <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] bg-white/[0.08] rounded-full" />
                </div>

                <div className="relative h-full flex items-center">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2.5 mb-5 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-full border border-white/20">
                        <Icon size={16} className="text-white" />
                        <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">WholesaleX Pro</span>
                      </div>
                      <h2 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white mb-4 lg:mb-5 leading-[1.1] tracking-tight">
                        {hero.title}
                      </h2>
                      <p className="text-base sm:text-lg lg:text-xl text-white/80 mb-8 lg:mb-10 leading-relaxed max-w-lg">
                        {hero.subtitle}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={hero.link}
                          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-primary-700 font-bold rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg shadow-black/20 text-sm lg:text-base"
                        >
                          {hero.cta} <ArrowRight size={18} />
                        </Link>
                        <Link
                          href="/categories"
                          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/25 hover:bg-white/20 transition-all duration-200 text-sm lg:text-base"
                        >
                          Explore Categories
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {FALLBACK_HEROES.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/15 backdrop-blur-sm hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-all duration-200" aria-label="Previous">
              <ChevronLeft size={20} />
            </button>
            <button onClick={next} className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/15 backdrop-blur-sm hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-all duration-200" aria-label="Next">
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {FALLBACK_HEROES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`transition-all duration-300 rounded-full ${i === current ? "w-8 h-2.5 bg-white" : "w-2.5 h-2.5 bg-white/50 hover:bg-white/70"}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[420px] sm:h-[480px] lg:h-[560px]">
        {banners.map((banner, index) => (
          <a
            key={banner.id}
            href={banner.linkUrl || "#"}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <Image src={banner.imageUrl} alt={banner.title} fill className="object-cover" priority={index === 0} sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-lg">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 lg:mb-4 leading-tight tracking-tight">{banner.title}</h2>
                  {banner.subtitle && <p className="text-base sm:text-lg text-white/90 mb-5 lg:mb-6 leading-relaxed">{banner.subtitle}</p>}
                  {banner.buttonText && (
                    <span className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-bold rounded-xl hover:bg-blue-50 transition shadow-lg text-sm lg:text-base">
                      {banner.buttonText} <ArrowRight size={16} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/15 backdrop-blur-sm hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-all duration-200" aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <button onClick={next} className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/15 backdrop-blur-sm hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-all duration-200" aria-label="Next">
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`transition-all duration-300 rounded-full ${i === current ? "w-8 h-2.5 bg-white" : "w-2.5 h-2.5 bg-white/50 hover:bg-white/70"}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}