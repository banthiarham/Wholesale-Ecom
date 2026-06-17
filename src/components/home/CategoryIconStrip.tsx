"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
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
    <section className="py-8 lg:py-10 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Browse Categories</h2>
          <div className="hidden sm:flex gap-1.5">
            <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-primary-600 hover:border-primary-300 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-primary-600 hover:border-primary-300 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div ref={scrollRef} className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
          {categories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.handle] || CATEGORY_ICONS[cat.name.toLowerCase()] || Monitor
            const colorClass = COLORS[i % COLORS.length]
            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.handle}`}
                className="flex flex-col items-center gap-2.5 min-w-[85px] group"
              >
                <div className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm ${colorClass}`}>
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" sizes="40px" />
                  ) : (
                    <Icon size={28} />
                  )}
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-primary-600 transition-colors text-center leading-tight max-w-[85px]">
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