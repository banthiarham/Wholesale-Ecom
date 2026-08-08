"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Monitor, Laptop, Smartphone, Wind, Refrigerator, WashingMachine,
  CookingPot, Speaker, Watch, Camera, Droplets, Printer, Gamepad2, Sparkles,
  type LucideIcon,
} from "lucide-react"
import { useCategories, flattenCategories } from "@/lib/categories/CategoriesProvider"

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  electronics: Monitor, "mobile-phones": Smartphone, televisions: Monitor,
  laptops: Laptop, "air-conditioners": Wind, refrigerators: Refrigerator,
  "washing-machines": WashingMachine, "kitchen-appliances": CookingPot,
  "home-entertainment": Speaker, "smart-watches": Watch, cameras: Camera,
  "water-purifiers": Droplets, printers: Printer, gaming: Gamepad2,
  "personal-care": Sparkles, fashion: Sparkles, industrial: Monitor,
}

export default function CategoryIconStrip() {
  const { categories: categoryTree } = useCategories()
  const categories = useMemo(() => flattenCategories(categoryTree).slice(0, 14), [categoryTree])

  if (categories.length === 0) return null

  return (
    <section className="py-4 lg:py-5 bg-white border-b border-gray-100">
      <div className="section-container">
        <div
          className="flex items-start gap-5 sm:gap-7 lg:gap-0 lg:justify-between overflow-x-auto pb-1 scrollbar-hide scroll-smooth"
        >
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.handle] || CATEGORY_ICONS[cat.name.toLowerCase()] || Monitor
            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.handle}`}
                className="flex flex-col items-center gap-2 min-w-[76px] group shrink-0"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-gray-100 flex items-center justify-center overflow-hidden group-hover:border-primary-300 group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200">
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} width={36} height={36} className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
                  ) : (
                    <Icon size={24} className="text-gray-500 group-hover:text-primary-600 transition-colors" />
                  )}
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-gray-700 group-hover:text-primary-600 transition-colors text-center leading-tight max-w-[80px] line-clamp-2">
                  {cat.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}