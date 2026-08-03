"use client"

import { Truck, BadgeCheck, Tag, Lock, Award, Headphones, ShieldCheck, IndianRupee, FileText, Clock, RefreshCcw } from "lucide-react"

// Keep legacy icon keys resolvable so existing admin-configured sections don't break.
const ICON_MAP: Record<string, any> = {
  Truck, BadgeCheck, Tag, Lock, Award, Headphones,
  ShieldCheck, IndianRupee, FileText, Clock, RefreshCcw,
}

interface TrustBadgesSectionProps {
  items?: { icon: string; title: string; desc: string }[]
}

const DEFAULT_ITEMS = [
  { icon: "Truck", title: "Fast Delivery", desc: "Receive your wholesale orders quickly with reliable nationwide shipping." },
  { icon: "BadgeCheck", title: "Verified Suppliers", desc: "All sellers are verified to ensure genuine products and trusted business transactions." },
  { icon: "Tag", title: "Wholesale Pricing", desc: "Get the best bulk prices with exclusive discounts for business buyers." },
  { icon: "Lock", title: "Secure Payments", desc: "100% secure checkout with Razorpay and protected online transactions." },
  { icon: "Award", title: "Quality Products", desc: "Carefully selected products with consistent quality and trusted brands." },
  { icon: "Headphones", title: "24/7 Business Support", desc: "Dedicated support team available whenever your business needs assistance." },
]

const CARD_COLORS = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-violet-50 text-violet-600",
  "bg-rose-50 text-rose-600",
  "bg-cyan-50 text-cyan-600",
]

export default function TrustBadgesSection({ items }: TrustBadgesSectionProps) {
  const badges = items && items.length > 0 ? items : DEFAULT_ITEMS

  return (
    <section className="section-padding-tight">
      <div className="section-container">
        <div className="mb-6 lg:mb-8 text-center">
          <span className="eyebrow">Trust &amp; Reliability</span>
          <h2 className="heading-lg">Why Choose Us</h2>
          <p className="body-sm mt-1.5">Everything you need for reliable wholesale buying</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
          {badges.map((badge, i) => {
            const IconComponent = ICON_MAP[badge.icon] || Truck
            const colorClass = CARD_COLORS[i % CARD_COLORS.length]
            return (
              <div
                key={i}
                className="group card-base-static h-full flex flex-col p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 shadow-sm ${colorClass}`}>
                  <IconComponent size={22} strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5 leading-snug tracking-tight">{badge.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{badge.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
