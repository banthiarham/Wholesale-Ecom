export function ProductCardSkeleton({ view = "grid" }: { view?: "grid" | "list" | "compact" }) {
  if (view === "list") {
    return (
      <div className="card-base-static flex gap-4 p-4 animate-pulse">
        <div className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-xl bg-gray-100" />
        <div className="flex-1 min-w-0 space-y-3 py-1">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-3/4 bg-gray-100 rounded" />
          <div className="h-4 w-1/3 bg-gray-100 rounded" />
          <div className="h-9 w-32 bg-gray-100 rounded-xl mt-2" />
        </div>
      </div>
    )
  }

  return (
    <div className="card-base-static overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-gray-100 rounded" />
        <div className="h-4 w-4/5 bg-gray-100 rounded" />
        <div className="h-4 w-2/5 bg-gray-100 rounded" />
        <div className="h-9 w-full bg-gray-100 rounded-xl mt-2" />
      </div>
    </div>
  )
}

interface ProductGridSkeletonProps {
  count?: number
  view?: "grid" | "list"
  className?: string
}

export function ProductGridSkeleton({ count = 8, view = "grid", className }: ProductGridSkeletonProps) {
  const items = Array.from({ length: count })

  if (view === "list") {
    return (
      <div className={`space-y-4 ${className ?? ""}`}>
        {items.map((_, i) => (
          <ProductCardSkeleton key={i} view="list" />
        ))}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 ${className ?? ""}`}>
      {items.map((_, i) => (
        <ProductCardSkeleton key={i} view="grid" />
      ))}
    </div>
  )
}
