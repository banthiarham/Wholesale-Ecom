"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Layers, ChevronRight, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface PackageGroup {
  id: string
  name: string
  required: boolean
  discountType?: string
  discountValue?: number
}

interface PackageTemplate {
  id: string
  title: string
  handle: string
  description?: string
  basePrice: string
  thumbnail?: string | null
  images?: string[]
  status: string
  groups: PackageGroup[]
}

const GROUP_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-purple-500 to-pink-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-red-400",
  "from-indigo-500 to-violet-400",
]

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/packages?status=PUBLISHED")
      .then((res) => res.json())
      .then((data) => setPackages(data.packages || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = packages.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.description?.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-primary-600">Home</Link>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">Packages</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Product Packages</h1>
          <p className="text-gray-600 mt-2">Configure your perfect package. Pick your components, get exclusive discounts, and build exactly what you need.</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages..."
            className="w-full max-w-md pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Package Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Layers size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">No packages found</h2>
            <p className="text-gray-500 mt-2">
              {search ? "Try a different search term" : "There are no packages available yet."}
            </p>
            {search && (
              <button onClick={() => setSearch("")} className="mt-4 text-primary-600 hover:underline text-sm">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((pkg) => {
              const image = pkg.thumbnail || pkg.images?.[0]
              const discountGroups = pkg.groups.filter((g) => g.discountType)
              return (
                <Link
                  key={pkg.id}
                  href={`/packages/${pkg.handle}`}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group"
                >
                  {/* Image area */}
                  <div className="relative h-48 bg-gradient-to-br from-primary-500 to-primary-700 overflow-hidden">
                    {image ? (
                      <img src={image} alt={pkg.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Layers size={48} className="text-white/30" />
                      </div>
                    )}
                    {/* Status badge */}
                    {discountGroups.length > 0 && (
                      <span className="absolute top-3 right-3 px-2.5 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow">
                        Save with packages
                      </span>
                    )}
                    {/* Group count badge */}
                    <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold rounded-full">
                      {pkg.groups.length} component{pkg.groups.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary-600 transition line-clamp-1">
                      {pkg.title}
                    </h3>
                    {pkg.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pkg.description}</p>
                    )}

                    {/* Groups preview */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {pkg.groups.slice(0, 4).map((g, i) => (
                        <span
                          key={g.id}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r ${GROUP_GRADIENTS[i % GROUP_GRADIENTS.length]} text-white`}
                        >
                          {g.name}
                        </span>
                      ))}
                      {pkg.groups.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                          +{pkg.groups.length - 4} more
                        </span>
                      )}
                    </div>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <div>
                        {Number(pkg.basePrice) > 0 ? (
                          <div>
                            <span className="text-xs text-gray-500">Starting from</span>
                            <p className="text-lg font-bold text-primary-700">{formatPrice(Number(pkg.basePrice))}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Configure & see price</p>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-sm font-medium text-primary-600 group-hover:text-primary-700 transition">
                        Configure <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}