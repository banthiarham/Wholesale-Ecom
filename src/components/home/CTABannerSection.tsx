"use client"

import Link from "next/link"

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
  subtext = "Sign up for free and get access to exclusive wholesale pricing today.",
  ctaText = "Get Started Free",
  ctaLink = "/register",
  ctaText2 = "Request a Quote",
  ctaLink2 = "/rfqs/new",
}: CTABannerSectionProps) {
  return (
    <section className="bg-gradient-to-r from-primary-700 to-blue-500 py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">{headline}</h2>
          <p className="text-blue-100">{subtext}</p>
        </div>
        <div className="flex gap-4">
          <Link href={ctaLink} className="px-8 py-3.5 bg-white text-primary-700 font-semibold rounded-lg hover:bg-blue-50 transition shadow-lg text-sm">
            {ctaText}
          </Link>
          <Link href={ctaLink2} className="px-8 py-3.5 bg-white/10 backdrop-blur text-white font-semibold rounded-lg border border-white/30 hover:bg-white/20 transition text-sm">
            {ctaText2}
          </Link>
        </div>
      </div>
    </section>
  )
}