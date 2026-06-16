"use client"

import { useState, useEffect } from "react"
import { formatPrice } from "@/lib/utils"
import PackageGroupSelector from "./PackageGroupSelector"
import PackagePriceSummary from "./PackagePriceSummary"

interface PackageGroup {
  id: string
  name: string
  description?: string
  required: boolean
  minSelect: number
  maxSelect: number
  discountType?: string
  discountValue?: number
  maxDiscount?: number
  categoryId?: string
  products: any[]
  defaultProductId?: string | null
}

interface PackageTemplate {
  id: string
  title: string
  handle: string
  description?: string
  basePrice: number
  thumbnail?: string
  images: string[]
  status: string
  groups: PackageGroup[]
}

interface Props {
  pkg: PackageTemplate
  userId?: string
}

export default function PackageConfigurator({ pkg, userId }: Props) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")

  // Set default selections
  useEffect(() => {
    const defaults: Record<string, string> = {}
    for (const group of pkg.groups) {
      const defaultProduct = group.products?.find((p: any) => p.isDefault)
      if (defaultProduct) {
        defaults[group.id] = defaultProduct.id
      } else if (group.products?.length === 1) {
        defaults[group.id] = group.products[0].id
      }
    }
    setSelections(defaults)
  }, [pkg.id])

  const handleSelect = (groupId: string, productId: string) => {
    setSelections((prev) => ({ ...prev, [groupId]: productId }))
  }

  const handleAddToCart = async () => {
    // Validate required groups
    for (const group of pkg.groups) {
      if (group.required && !selections[group.id]) {
        setError(`Please select a ${group.name}`)
        return
      }
    }

    setError("")
    setAdding(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const token = localStorage.getItem("token")
      if (token) headers["Authorization"] = `Bearer ${token}`
      const sessionId = localStorage.getItem("cart_session_id") || crypto.randomUUID()
      localStorage.setItem("cart_session_id", sessionId)
      headers["x-session-id"] = sessionId

      const res = await fetch("/api/packages/cart", {
        method: "POST",
        headers,
        body: JSON.stringify({
          packageId: pkg.id,
          selections: Object.entries(selections)
            .filter(([, productId]) => productId)
            .map(([groupId, productId]) => ({ groupId, productId })),
          quantity: 1,
          sessionId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to add package to cart")
      }

      // Dispatch cart update event
      window.dispatchEvent(new CustomEvent("cart-updated"))
    } catch (err: any) {
      setError(err.message || "Failed to add to cart")
    } finally {
      setAdding(false)
    }
  }

  const requiredGroups = pkg.groups.filter((g) => g.required)
  const allRequiredSelected = requiredGroups.every((g) => selections[g.id])

  return (
    <div className="space-y-6">
      {/* Package header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pkg.title}</h1>
        {pkg.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{pkg.description}</p>
        )}
        {Number(pkg.basePrice) > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Base configuration:</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatPrice(Number(pkg.basePrice))}</span>
          </div>
        )}
      </div>

      {/* Group selectors */}
      <div className="space-y-4">
        {pkg.groups.map((group) => (
          <PackageGroupSelector
            key={group.id}
            group={group}
            selectedProductId={selections[group.id]}
            onSelect={(productId) => handleSelect(group.id, productId)}
          />
        ))}
      </div>

      {/* Price summary and add to cart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 sticky bottom-4">
        <PackagePriceSummary pkg={pkg} selections={selections} />

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={handleAddToCart}
          disabled={!allRequiredSelected || adding}
          className={`mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition text-sm ${
            allRequiredSelected && !adding
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          }`}
        >
          {adding ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Adding...
            </>
          ) : (
            !allRequiredSelected ? `Select ${requiredGroups.find((g) => !selections[g.id])?.name || "required options"}` : "Add Package to Cart"
          )}
        </button>
      </div>
    </div>
  )
}