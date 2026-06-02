"use client"

import { Truck, ShieldCheck, Tag, IndianRupee, FileText, Clock } from "lucide-react"

const ICON_MAP: Record<string, any> = { Truck, ShieldCheck, Tag, IndianRupee, FileText, Clock }

interface TrustBadgesSectionProps {
  items?: { icon: string; title: string; desc: string }[]
}

const DEFAULT_ITEMS = [
  { icon: "Truck", title: "Fast Delivery", desc: "Reliable shipping across India" },
  { icon: "ShieldCheck", title: "Genuine Products", desc: "100% authentic guaranteed" },
  { icon: "IndianRupee", title: "Best Prices", desc: "Wholesale pricing guaranteed" },
  { icon: "Tag", title: "Bulk Pricing", desc: "Automatic volume discounts" },
]

export default function TrustBadgesSection({ items }: TrustBadgesSectionProps) {
  const badges = items && items.length > 0 ? items : DEFAULT_ITEMS

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge, i) => {
            const IconComponent = ICON_MAP[badge.icon] || Truck
            return (
              <div key={i} className="text-center p-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <IconComponent size={24} className="text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{badge.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}