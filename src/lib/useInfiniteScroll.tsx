"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Pagination-free listing: starts with `batch` items and reveals `batch` more each time the
 * sentinel (rendered by <ScrollSentinel/> below the list) scrolls near the viewport. Pass a
 * `resetKey` that changes whenever the underlying list/sort/filter changes so the list starts
 * from the top again.
 */
export function useInfiniteScroll(total: number, resetKey: unknown, batch = 20) {
  const [count, setCount] = useState(batch)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setCount(batch) }, [resetKey, batch])

  const hasMore = count < total
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(total, c + batch)) },
      { rootMargin: "600px 0px" }
    )
    io.observe(el)
    // Re-created after every reveal, so it fires again right away if the sentinel is still in range.
    return () => io.disconnect()
  }, [count, hasMore, total, batch])

  return { visibleCount: Math.min(count, total), hasMore, sentinelRef }
}

export function ScrollSentinel({ hasMore, sentinelRef }: { hasMore: boolean; sentinelRef: React.RefObject<HTMLDivElement> }) {
  if (!hasMore) return null
  return (
    <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
      Loading more…
    </div>
  )
}
