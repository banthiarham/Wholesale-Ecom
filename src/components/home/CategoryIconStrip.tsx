"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Monitor, Laptop, Smartphone, Wind, Refrigerator, WashingMachine,
  CookingPot, Speaker, Watch, Camera, Droplets, Printer, Gamepad2, Sparkles,
  ChevronLeft, ChevronRight,
  type LucideIcon,
} from "lucide-react"

interface Category {
  id: string
  name: string
  handle: string
  image: string | null
  _count?: { products: number }
  children?: Category[]
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  electronics: Monitor, "mobile-phones": Smartphone, televisions: Monitor,
  laptops: Laptop, "air-conditioners": Wind, refrigerators: Refrigerator,
  "washing-machines": WashingMachine, "kitchen-appliances": CookingPot,
  "home-entertainment": Speaker, "smart-watches": Watch, cameras: Camera,
  "water-purifiers": Droplets, printers: Printer, gaming: Gamepad2,
  "personal-care": Sparkles, fashion: Sparkles, industrial: Monitor,
}

const COLORS = [
  "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  "bg-violet-50 text-violet-600 group-hover:bg-violet-100",
  "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100",
  "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
  "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
  "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  "bg-sky-50 text-sky-600 group-hover:bg-sky-100",
  "bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-100",
  "bg-lime-50 text-lime-600 group-hover:bg-lime-100",
  "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  "bg-green-50 text-green-600 group-hover:bg-green-100",
]

export default function CategoryIconStrip() {
  const [categories, setCategories] = useState<Category[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const cats: Category[] = []
        const walk = (arr: Category[]) => { for (const c of arr || []) { cats.push(c); walk(c.children || []) } }
        walk(data.categories || [])
        setCategories(cats.slice(0, 14))
      })
      .catch((err) => { console.error("Failed to fetch categories:", err) })
  }, [])

  if (categories.length === 0) return null

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" })
  }

  return (
    <section className="py-7 lg:py-9 border-b border-gray-100">
      <div className="section-container">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="eyebrow">Explore</span>
            <h2 className="heading-md">Browse Categories</h2>
          </div>
          <div className="hidden sm:flex gap-2">
            <button onClick={() => scroll(-1)} className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-primary-600 hover:border-primary-300 hover:shadow-md transition-all duration-200" aria-label="Scroll left">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => scroll(1)} className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-primary-600 hover:border-primary-300 hover:shadow-md transition-all duration-200" aria-label="Scroll right">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
          style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)", maskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)" }}
        >
          {categories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.handle] || CATEGORY_ICONS[cat.name.toLowerCase()] || Monitor
            const colorClass = COLORS[i % COLORS.length]
            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.handle}`}
                className="flex flex-col items-center gap-3 min-w-[88px] group"
              >
                <div
                  className={`w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 ${colorClass}`}
                >
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                  ) : (
                    <Icon size={28} />
                  )}
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-primary-600 transition-colors text-center leading-tight max-w-[88px]">
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