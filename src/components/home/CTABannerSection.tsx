"use client"

import Link from "next/link"
import { ArrowRight, Zap } from "lucide-react"

interface CTABannerSectionProps {
  headline?: string
  subtext?: string
  ctaText?: string
  ctaLink?: string
  ctaText2?: string
  ctaLink2?: string
}

export default function CTABannerSection({
  headline = "Ready to buy in bulk?",
  subtext = "Sign up for free and get access to exclusive wholesale pricing, tier discounts, and priority shipping.",
  ctaText = "Get Started Free",
  ctaLink = "/register",
  ctaText2 = "Request a Quote",
  ctaLink2 = "/rfqs/new",
}: CTABannerSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gray-900 py-16 lg:py-24">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16">
          <div className="lg:max-w-xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 bg-primary-600/20 rounded-full border border-primary-500/30">
              <Zap size={14} className="text-primary-400" />
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">Wholesale Platform</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight tracking-tight">{headline}</h2>
            <p className="text-gray-400 text-base leading-relaxed">{subtext}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={ctaLink} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all duration-200 shadow-lg shadow-primary-600/30 text-sm">
              {ctaText} <ArrowRight size={16} />
            </Link>
            <Link href={ctaLink2} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 backdrop-blur text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-200 text-sm">
              {ctaText2}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}