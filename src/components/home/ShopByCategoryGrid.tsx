"use client"

import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ChevronLeft, ChevronRight, Package } from "lucide-react"
import { useCategories } from "@/lib/categories/CategoriesProvider"

interface ShopByCategoryGridProps { columns?: number }

/** Compact strip of category tiles (image + name) with scroll arrows and an "All Categories" link. */
export default function ShopByCategoryGrid(_props: ShopByCategoryGridProps) {
  const { categories } = useCategories()
  const trackRef = useRef<HTMLDivElement>(null)
  const move = (direction: -1 | 1) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth * 0.8, behavior: "smooth" })
  if (!categories.length) return null

  return (
    <section className="py-4 lg:py-6">
      <div className="section-container">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="heading-lg">Shop by Category</h2>
            <p className="body-sm mt-1">Browse products by industry</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="carousel-arrow !h-9 !w-9" aria-label="Previous categories"><ChevronLeft size={18} /></button>
            <button onClick={() => move(1)} className="carousel-arrow !h-9 !w-9" aria-label="Next categories"><ChevronRight size={18} /></button>
            <Link href="/categories" className="ml-2 hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700">
              All Categories <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div ref={trackRef} className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-1">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.handle}`}
              className="group shrink-0 w-[132px] sm:w-[148px] rounded-2xl border border-gray-100 bg-white text-center shadow-sm overflow-hidden hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="relative h-24 sm:h-28 bg-primary-50/70 flex items-center justify-center overflow-hidden">
                {cat.image ? (
                  <Image src={cat.image} alt={cat.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="148px" />
                ) : (
                  <Package size={30} className="text-primary-400 transition-transform duration-300 group-hover:scale-110" />
                )}
              </div>
              <p className="mx-2.5 mt-2 mb-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-gray-800 group-hover:text-primary-700 leading-snug line-clamp-2 min-h-[2rem]">{cat.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
