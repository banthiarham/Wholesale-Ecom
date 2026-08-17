"use client"

import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ChevronLeft, ChevronRight, Package } from "lucide-react"
import { useCategories } from "@/lib/categories/CategoriesProvider"

interface ShopByCategoryGridProps { columns?: number }
const COLORS = ["from-blue-500 to-blue-700","from-violet-500 to-violet-700","from-emerald-500 to-emerald-700","from-orange-500 to-orange-700","from-cyan-500 to-cyan-700","from-rose-500 to-rose-700","from-amber-500 to-amber-700","from-indigo-500 to-indigo-700"]

export default function ShopByCategoryGrid({ columns = 4 }: ShopByCategoryGridProps) {
  const { categories } = useCategories()
  const trackRef = useRef<HTMLDivElement>(null)
  const move = (direction: -1 | 1) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth, behavior: "smooth" })
  if (!categories.length) return null

  return <section className="py-6 lg:py-8 bg-slate-50/80">
    <div className="section-container">
      <div className="section-header items-end">
        <div><h2 className="heading-lg">Shop by Category</h2><p className="body-sm mt-1.5">Browse products by industry</p></div>
        <div className="flex items-center gap-2">
          {categories.length > columns && <><button onClick={()=>move(-1)} className="carousel-arrow" aria-label="Previous categories"><ChevronLeft size={18}/></button><button onClick={()=>move(1)} className="carousel-arrow" aria-label="Next categories"><ChevronRight size={18}/></button></>}
          <Link href="/categories" className="ml-2 hidden items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 lg:inline-flex">All Categories <ArrowRight size={16}/></Link>
        </div>
      </div>
      <div ref={trackRef} className="carousel-track scrollbar-hide">
        {categories.map((cat,i)=><Link key={cat.id} href={`/categories/${cat.handle}`} className="carousel-category-item group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl">
          <div className="relative h-44 overflow-hidden">
            {cat.image?<Image src={cat.image} alt={cat.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:640px) 82vw,(max-width:1024px) 45vw,25vw"/>:<div className={`flex h-full items-center justify-center bg-gradient-to-br ${COLORS[i%COLORS.length]}`}><Package size={42} className="text-white/75"/></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/10 to-transparent"/>
            <h3 className="absolute bottom-4 left-4 right-4 line-clamp-3 text-base font-bold leading-snug text-white">{cat.name}</h3>
          </div>
          <div className="min-h-[92px] p-4"><p className="line-clamp-3 text-sm font-semibold leading-relaxed text-slate-800 transition-colors group-hover:text-primary-700">{cat.name}</p></div>
        </Link>)}
      </div>
    </div>
  </section>
}
