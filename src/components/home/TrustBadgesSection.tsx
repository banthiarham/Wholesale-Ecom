"use client"

import { Truck, ShieldCheck, Tag, IndianRupee, FileText, Clock, Headphones, RefreshCcw } from "lucide-react"

const ICON_MAP: Record<string, any> = { Truck, ShieldCheck, Tag, IndianRupee, FileText, Clock, Headphones, RefreshCcw }

interface TrustBadgesSectionProps {
  items?: { icon: string; title: string; desc: string }[]
}

const DEFAULT_ITEMS = [
  { icon: "Truck", title: "Fast Delivery", desc: "Reliable shipping across India" },
  { icon: "ShieldCheck", title: "Genuine Products", desc: "100% authentic guaranteed" },
  { icon: "IndianRupee", title: "Best Prices", desc: "Wholesale pricing guaranteed" },
  { icon: "Tag", title: "Bulk Pricing", desc: "Automatic volume discounts" },
  { icon: "Headphones", title: "24/7 Support", desc: "Dedicated customer assistance" },
  { icon: "RefreshCcw", title: "Easy Returns", desc: "Hassle-free return policy" },
]

export default function TrustBadgesSection({ items }: TrustBadgesSectionProps) {
  const badges = items && items.length > 0 ? items : DEFAULT_ITEMS

  return (
    <section className="section-padding">
      <div className="section-container">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
          {badges.map((badge, i) => {
            const IconComponent = ICON_MAP[badge.icon] || Truck
            return (
              <div key={i} className="text-center p-6 bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-3.5 group-hover:bg-primary-100 transition-colors duration-200">
                  <IconComponent size={24} className="text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{badge.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{badge.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}