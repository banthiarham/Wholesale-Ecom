"use client"

import { useRef, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ProductCarouselProps { items: ReactNode[] }

export function ProductCarousel({ items }: ProductCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const move = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" })
  }
  if (!items.length) return null

  return (
    <div className="relative">
      {items.length > 4 && (
        <div className="absolute -top-14 right-0 z-10 hidden items-center gap-2 sm:flex">
          <button type="button" onClick={() => move(-1)} aria-label="Previous products" className="carousel-arrow"><ChevronLeft size={18}/></button>
          <button type="button" onClick={() => move(1)} aria-label="Next products" className="carousel-arrow"><ChevronRight size={18}/></button>
        </div>
      )}
      <div ref={trackRef} className="carousel-track scrollbar-hide">
        {items.map((item, i) => <div key={i} className="carousel-product-item">{item}</div>)}
      </div>
    </div>
  )
}
