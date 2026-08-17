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

const CATEGORY_HEROES: Banner[] = [
  {
    id: "electronics-hero",
    title: "Electronics for Every Business",
    subtitle: "Source trusted computers, power solutions, networking equipment, accessories, and electrical essentials at wholesale prices.",
    imageUrl: "/images/electronics-hero.png",
    linkUrl: "/products",
    buttonText: "Shop Electronics",
    section: "hero",
  },
  {
    id: "electronics-networking-hero",
    title: "Computing & Networking Solutions",
    subtitle: "Equip your business with computers, routers, switches, cables, and connectivity essentials in bulk.",
    imageUrl: "/images/electronics-networking-hero.png",
    linkUrl: "/products",
    buttonText: "Explore Networking",
    section: "hero",
  },
  {
    id: "electronics-power-hero",
    title: "Reliable Power for Every Setup",
    subtitle: "Shop UPS systems, power protection, LED lighting, chargers, adapters, and electrical essentials.",
    imageUrl: "/images/electronics-power-hero.png",
    linkUrl: "/products",
    buttonText: "Shop Power Products",
    section: "hero",
  },
  {
    id: "electronics-security-hero",
    title: "Smart Security & Accessories",
    subtitle: "Discover CCTV systems, smart devices, audio accessories, chargers, and connectivity products.",
    imageUrl: "/images/electronics-security-hero.png",
    linkUrl: "/products",
    buttonText: "View Smart Electronics",
    section: "hero",
  },
]

const FALLBACK_HEROES = [
  {
    title: "Bulk Orders. Best Prices.",
    subtitle: "India's trusted B2B wholesale marketplace. Get exclusive tier pricing, contract deals, and fast shipping across India.",
    gradient: "from-primary-800 via-primary-700 to-primary-500",
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
    gradient: "from-teal-700 via-teal-600 to-cyan-500",
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
        setBanners(list.length > 0 ? list : CATEGORY_HEROES)
      })
      .catch((err) => {
        console.error("Failed to fetch hero banners:", err)
        setBanners(CATEGORY_HEROES)
      })
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
        <div className="relative h-[430px] sm:h-[500px] lg:h-[560px]">
          {FALLBACK_HEROES.map((hero, index) => {
            const Icon = hero.icon
            return (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out bg-gradient-to-br ${hero.gradient} ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
              >
                {/* Decorative shapes + subtle dot texture */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute inset-0 opacity-[0.15]"
                    style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
                  />
                  <div className="absolute -top-40 -right-24 w-[560px] h-[560px] bg-white/[0.08] rounded-full blur-2xl" />
                  <div className="absolute bottom-0 left-0 w-[340px] h-[340px] bg-black/[0.10] rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
                  <div className="absolute top-1/4 right-1/4 w-[220px] h-[220px] bg-white/[0.10] rounded-full blur-xl" />
                </div>

                <div className="relative h-full flex items-center">
                  <div className="section-container w-full">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2.5 mb-6 px-4 py-2 bg-white/15 backdrop-blur-md rounded-full border border-white/25 shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
                        <Icon size={16} className="text-white" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">WholesaleX Pro</span>
                      </div>
                      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 lg:mb-6 leading-[1.05] tracking-tight text-balance">
                        {hero.title}
                      </h2>
                      <p className="text-base sm:text-lg lg:text-xl text-white/85 mb-9 lg:mb-10 leading-relaxed max-w-lg font-light">
                        {hero.subtitle}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3.5">
                        <Link
                          href={hero.link}
                          className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.35)] text-sm lg:text-base"
                        >
                          {hero.cta} <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                          href="/categories"
                          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-200 text-sm lg:text-base"
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
            <button onClick={prev} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 bg-white/15 backdrop-blur-md hover:bg-white/30 hover:scale-105 text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/10" aria-label="Previous">
              <ChevronLeft size={20} />
            </button>
            <button onClick={next} className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 bg-white/15 backdrop-blur-md hover:bg-white/30 hover:scale-105 text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/10" aria-label="Next">
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {FALLBACK_HEROES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`transition-all duration-300 rounded-full ${i === current ? "w-8 h-2.5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]" : "w-2.5 h-2.5 bg-white/50 hover:bg-white/70"}`}
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
      <div className="relative h-[430px] sm:h-[500px] lg:h-[560px]">
        {banners.map((banner, index) => (
          <a
            key={banner.id}
            href={banner.linkUrl || "#"}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              fill
              className={`object-cover ${banner.imageUrl.includes("/images/electronics-") ? "brightness-[1.22] saturate-[0.88]" : ""}`}
              sizes="100vw"
              priority={index === 0}
            />
            <div className={`absolute inset-0 ${banner.imageUrl.includes("/images/electronics-") ? "bg-gradient-to-r from-primary-900/70 via-primary-700/20 to-white/5" : "bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-black/10"}`} />
            <div className="absolute inset-0 flex items-center">
              <div className="section-container w-full">
                <div className="max-w-lg">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 lg:mb-5 leading-[1.1] tracking-tight text-balance">{banner.title}</h2>
                  {banner.subtitle && <p className="text-base sm:text-lg text-white/85 mb-6 lg:mb-7 leading-relaxed font-light">{banner.subtitle}</p>}
                  {banner.buttonText && (
                    <span className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.35)] text-sm lg:text-base">
                      {banner.buttonText} <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
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
          <button onClick={prev} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 bg-white/15 backdrop-blur-md hover:bg-white/30 hover:scale-105 text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/10" aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <button onClick={next} className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 bg-white/15 backdrop-blur-md hover:bg-white/30 hover:scale-105 text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/10" aria-label="Next">
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`transition-all duration-300 rounded-full ${i === current ? "w-8 h-2.5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]" : "w-2.5 h-2.5 bg-white/50 hover:bg-white/70"}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
