"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Matches the sm/lg breakpoints used throughout the storefront.
const BREAKPOINT_SM = 640
const BREAKPOINT_LG = 1024
const GAP_PX = 16

function getVisibleCount(width: number) {
  if (width >= BREAKPOINT_LG) return 4
  if (width >= BREAKPOINT_SM) return 2
  return 1
}

interface ProductCarouselProps {
  items: ReactNode[]
}

/**
 * Windowed product carousel: exactly `visibleCount` full cards per view
 * (4 desktop / 2 tablet / 1 mobile), sliding a full page at a time with no
 * half-visible cards. Falls back to a plain static row when everything
 * already fits in one view, so no arrows/dots are shown needlessly.
 */
export function ProductCarousel({ items }: ProductCarouselProps) {
  const [visibleCount, setVisibleCount] = useState(() =>
    typeof window !== "undefined" ? getVisibleCount(window.innerWidth) : 4
  )
  const [startIndex, setStartIndex] = useState(0)

  useEffect(() => {
    const onResize = () => setVisibleCount(getVisibleCount(window.innerWidth))
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const maxStart = Math.max(0, items.length - visibleCount)

  // Clamp the current window whenever the breakpoint or item count changes.
  useEffect(() => {
    setStartIndex((s) => Math.min(s, maxStart))
  }, [maxStart])

  const canPrev = startIndex > 0
  const canNext = startIndex < maxStart

  const goPrev = useCallback(() => setStartIndex((s) => Math.max(0, s - visibleCount)), [visibleCount])
  const goNext = useCallback(() => setStartIndex((s) => Math.min(maxStart, s + visibleCount)), [visibleCount, maxStart])

  // One pagination stop per full page, plus a final stop for the last (possibly partial) page.
  const stops = useMemo(() => {
    const s: number[] = []
    for (let i = 0; i <= maxStart; i += visibleCount) s.push(i)
    if (s[s.length - 1] !== maxStart) s.push(maxStart)
    return s
  }, [maxStart, visibleCount])

  const activeStop = stops.reduce((closest, s) => (Math.abs(s - startIndex) < Math.abs(closest - startIndex) ? s : closest), stops[0] ?? 0)

  if (items.length === 0) return null

  const showControls = items.length > visibleCount

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            gap: `${GAP_PX}px`,
            transform: `translateX(calc(-1 * ${startIndex} * (100% + ${GAP_PX}px) / ${visibleCount}))`,
            transition: "transform 500ms cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="min-w-0"
              style={{ flex: `0 0 calc((100% - ${GAP_PX * (visibleCount - 1)}px) / ${visibleCount})` }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {showControls && (
        <>
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Previous products"
            className="absolute left-2 top-[38%] -translate-y-1/2 z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg flex items-center justify-center text-gray-600 hover:text-primary-600 hover:border-primary-300 hover:scale-105 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:text-gray-600 disabled:hover:border-gray-200"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Next products"
            className="absolute right-2 top-[38%] -translate-y-1/2 z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg flex items-center justify-center text-gray-600 hover:text-primary-600 hover:border-primary-300 hover:scale-105 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:text-gray-600 disabled:hover:border-gray-200"
          >
            <ChevronRight size={20} />
          </button>

          {stops.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-5">
              {stops.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStartIndex(s)}
                  aria-label={`Go to slide ${s + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${s === activeStop ? "w-6 bg-primary-600" : "w-1.5 bg-gray-300 hover:bg-gray-400"}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
