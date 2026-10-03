"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, Truck } from "lucide-react"

interface CTABannerSectionProps {
  headline?: string
  subtext?: string
  ctaText?: string
  ctaLink?: string
  ctaText2?: string
  ctaLink2?: string
}

const HIGHLIGHTS = [
  { icon: CheckCircle2, label: "Bulk Pricing" },
  { icon: CheckCircle2, label: "Verified Suppliers" },
  { icon: Truck, label: "Reliable Delivery" },
]

export default function CTABannerSection({
  headline = "Ready to Buy in Bulk?",
  subtext = "Get the best wholesale prices with tier discounts and reliable delivery.",
  ctaText = "Browse Products",
  ctaLink = "/products",
  ctaText2 = "Request a Quote",
  ctaLink2 = "/rfqs/new",
}: CTABannerSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary-100 bg-gradient-to-r from-primary-50 via-primary-100/60 to-primary-50 px-6 py-8 sm:px-10 sm:py-10">
      {/* soft decorative blobs, theme-coloured */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-primary-300/30 blur-3xl" />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        <div className="lg:max-w-xl">
          <span className="eyebrow">Wholesale Platform</span>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{headline}</h2>
          <p className="mt-2 text-base text-gray-600 leading-relaxed">{subtext}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={ctaLink} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-sm">
              {ctaText} <ArrowRight size={16} />
            </Link>
            <Link href={ctaLink2} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary-700 font-semibold rounded-xl border border-primary-300 hover:bg-primary-50 transition-colors">
              {ctaText2}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-64">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl bg-white/90 border border-primary-100 px-4 py-3 shadow-sm">
              <Icon size={18} className="text-primary-600 shrink-0" />
              <span className="text-sm font-semibold text-gray-800">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
