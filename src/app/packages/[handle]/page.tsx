"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Package, Layers } from "lucide-react"
import Image from "next/image"
import { formatPrice } from "@/lib/utils"
import dynamic from "next/dynamic"

const PackageConfigurator = dynamic(() => import("@/components/storefront/PackageConfigurator"), { ssr: false })

interface PackageGroup {
  id: string
  name: string
  description?: string
  required: boolean
  minSelect: number
  maxSelect: number
  discountType?: string
  discountValue?: number
  products: any[]
}

interface PackageTemplate {
  id: string
  title: string
  handle: string
  description?: string
  basePrice: string
  thumbnail?: string | null
  images: string[]
  status: string
  groups: PackageGroup[]
}

export default function PackageDetailPage() {
  const params = useParams()
  const [pkg, setPkg] = useState<PackageTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [mainImage, setMainImage] = useState<string | null>(null)

  useEffect(() => {
    if (!params.handle) return
    fetch(`/api/packages/${params.handle}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found")
        return res.json()
      })
      .then((data) => {
        const p = data.package || data
        setPkg(p)
        setMainImage(p.thumbnail || p.images?.[0] || null)
      })
      .catch(() => setPkg(null))
      .finally(() => setLoading(false))
  }, [params.handle])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Layers size={48} className="text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Package not found</h1>
        <p className="text-gray-500 mt-2">This package may have been removed or is unavailable.</p>
        <Link href="/packages" className="mt-4 text-primary-600 hover:underline">Browse all packages</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary-600">Home</Link>
          <ChevronRight size={14} />
          <Link href="/packages" className="hover:text-primary-600">Packages</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium truncate">{pkg.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Images & Info */}
          <div className="space-y-6">
            {/* Main image */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden relative h-96">
              {mainImage ? (
                <Image src={mainImage} alt={pkg.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority />
              ) : (
                <div className="w-full h-96 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <Layers size={64} className="text-white/30" />
                </div>
              )}
              {pkg.images && pkg.images.length > 1 && (
                <div className="flex gap-2 p-4 overflow-x-auto">
                  {pkg.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setMainImage(img)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden relative ${mainImage === img ? "border-primary-600" : "border-transparent"}`}
                    >
                      <Image src={img} alt={`${pkg.title} ${idx + 1}`} fill className="object-cover" sizes="80px" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Package details card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900">{pkg.title}</h1>
              {pkg.description && (
                <p className="text-gray-600 mt-3 whitespace-pre-line leading-relaxed">{pkg.description}</p>
              )}

              {/* Component groups summary */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Component Groups</h3>
                <div className="space-y-2">
                  {pkg.groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{group.name}</span>
                        {group.required && (
                          <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-semibold rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Select {group.minSelect}-{group.maxSelect}</span>
                        {group.discountType && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 font-semibold rounded">
                            {group.discountType === "PERCENTAGE" ? `${group.discountValue}% off` : `₹${group.discountValue} off`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {Number(pkg.basePrice) > 0 && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg">
                  <span className="text-sm text-primary-700">Base configuration price:</span>
                  <span className="text-lg font-bold text-primary-700">{formatPrice(Number(pkg.basePrice))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Configurator */}
          <div>
            <PackageConfigurator pkg={{
              ...pkg,
              thumbnail: pkg.thumbnail || undefined,
              basePrice: Number(pkg.basePrice),
              groups: pkg.groups.map((g) => ({
                ...g,
                discountValue: g.discountValue ? Number(g.discountValue) : undefined,
                maxDiscount: (g as any).maxDiscount ? Number((g as any).maxDiscount) : undefined,
                products: g.products?.map((p: any) => ({
                  ...p,
                  ...(p.product ? {
                    id: p.product.id,
                    title: p.product.title,
                    unitPrice: p.product.unitPrice,
                    thumbnail: p.product.thumbnail,
                    images: p.product.images,
                    compareAtPrice: p.product.compareAtPrice,
                    isDefault: p.isDefault,
                  } : {}),
                })) || [],
                defaultProductId: g.products?.find((p: any) => p.isDefault)?.productId || null,
              })),
            }} />
          </div>
        </div>
      </main>
    </div>
  )
}