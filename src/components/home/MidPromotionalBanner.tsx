"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface Banner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  linkUrl: string | null
  buttonText: string | null
}

export default function MidPromotionalBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    fetch("/api/banners?section=mid")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.banners || []
        if (list.length > 0) setBanner(list[0])
      })
      .catch(() => {})
  }, [])

  if (!banner) return null

  const content = (
    <div className="relative overflow-hidden rounded-2xl">
      <img src={banner.imageUrl} alt={banner.title} className="w-full h-48 sm:h-64 md:h-80 object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">{banner.title}</h3>
          {banner.subtitle && <p className="text-sm sm:text-base text-white/90 mb-3">{banner.subtitle}</p>}
          {banner.buttonText && (
            <span className="inline-block px-5 py-2 bg-white text-primary-700 font-semibold rounded-lg text-sm hover:bg-blue-50 transition">
              {banner.buttonText}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (banner.linkUrl) return <Link href={banner.linkUrl}>{content}</Link>
  return content
}