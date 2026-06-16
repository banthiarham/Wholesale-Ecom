"use client"

import { useState, useEffect } from "react"
import { formatPrice } from "@/lib/utils"

interface PackageGroup {
  id: string
  name: string
  discountType?: string
  discountValue?: number
  maxDiscount?: number
}

interface PackageTemplate {
  id: string
  title: string
  basePrice: number
  groups: PackageGroup[]
}

interface Props {
  pkg: PackageTemplate
  selections: Record<string, string>
}

export default function PackagePriceSummary({ pkg, selections }: Props) {
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const selectionList = Object.entries(selections)
      .filter(([, productId]) => productId)
      .map(([groupId, productId]) => ({ groupId, productId }))

    if (selectionList.length === 0) {
      setPriceBreakdown(null)
      return
    }

    setLoading(true)
    fetch("/api/packages/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: pkg.id, selections: selectionList }),
    })
      .then((r) => r.json())
      .then((data) => setPriceBreakdown(data))
      .catch(() => setPriceBreakdown(null))
      .finally(() => setLoading(false))
  }, [pkg.id, selections])

  if (!priceBreakdown && !loading) {
    return (
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Select components to see pricing
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {Number(pkg.basePrice) > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Base configuration</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(pkg.basePrice))}</span>
        </div>
      )}

      {priceBreakdown?.components?.map((comp: any) => (
        <div key={comp.groupId} className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {comp.groupName}: {comp.productTitle}
          </span>
          <div className="text-right">
            <span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(comp.unitPrice)}</span>
            {comp.groupDiscount > 0 && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                -{formatPrice(comp.groupDiscount)}
              </span>
            )}
          </div>
        </div>
      ))}

      {priceBreakdown?.groupDiscounts?.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          {priceBreakdown.groupDiscounts.map((d: any) => (
            <div key={d.groupId} className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>{d.groupName} discount ({d.discountType === "PERCENTAGE" ? `${d.discountValue}%` : formatPrice(d.discountValue)})</span>
              <span>-{formatPrice(d.discountAmount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span className="font-bold text-gray-900 dark:text-gray-100">Package Total</span>
        <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
          {loading ? "..." : priceBreakdown ? formatPrice(priceBreakdown.subtotal) : formatPrice(Number(pkg.basePrice))}
        </span>
      </div>
    </div>
  )
}