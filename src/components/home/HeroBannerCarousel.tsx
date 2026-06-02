"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
      .catch(() => {})
  }, [])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % Math.max(banners.length, 1))
  }, [banners.length])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % Math.max(banners.length, 1))
  }, [banners.length])

  useEffect(() => {
    if (!autoplay || banners.length <= 1) return
    const timer = setInterval(next, speed || 5000)
    return () => clearInterval(timer)
  }, [autoplay, speed, next, banners.length])

  if (banners.length === 0) return null

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="relative h-64 sm:h-80 md:h-96 lg:h-[480px]">
        {banners.map((banner, index) => (
          <a
            key={banner.id}
            href={banner.linkUrl || "#"}
            className={`absolute inset-0 transition-opacity duration-700 ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <img
              src={banner.imageUrl}
              alt={banner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-lg">
                  <h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-white mb-2 lg:mb-4 leading-tight">{banner.title}</h2>
                  {banner.subtitle && <p className="text-sm sm:text-base lg:text-lg text-white/90 mb-3 lg:mb-6">{banner.subtitle}</p>}
                  {banner.buttonText && (
                    <span className="inline-block px-6 py-2.5 bg-white text-primary-700 font-semibold rounded-lg hover:bg-blue-50 transition text-sm lg:text-base">
                      {banner.buttonText}
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
          <button onClick={prev} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 backdrop-blur-sm hover:bg-white/40 text-white rounded-full p-2 transition" aria-label="Previous">
            <ChevronLeft size={24} />
          </button>
          <button onClick={next} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 backdrop-blur-sm hover:bg-white/40 text-white rounded-full p-2 transition" aria-label="Next">
            <ChevronRight size={24} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2.5 h-2.5 rounded-full transition ${i === current ? "bg-white scale-110" : "bg-white/50 hover:bg-white/70"}`} aria-label={`Go to slide ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}