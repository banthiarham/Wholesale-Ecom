"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"

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
      .catch((err) => { console.error("Failed to fetch promotional banners:", err) })
  }, [])

  if (!banner) return null

  const content = (
    <div className="relative overflow-hidden rounded-2xl group h-52 sm:h-64 md:h-80">
      <Image src={banner.imageUrl} alt={banner.title} fill className="img-zoom object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
      <div className="absolute inset-0 flex items-center">
        <div className="max-w-md pl-6 sm:pl-10 lg:pl-14">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 leading-tight">{banner.title}</h3>
          {banner.subtitle && <p className="text-sm sm:text-base text-white/90 mb-4 leading-relaxed">{banner.subtitle}</p>}
          {banner.buttonText && (
            <span className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition text-sm">
              {banner.buttonText} →
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <section className="section-padding-tight">
      <div className="section-container">
        {banner.linkUrl ? <Link href={banner.linkUrl}>{content}</Link> : content}
      </div>
    </section>
  )
}