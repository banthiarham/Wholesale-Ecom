"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function ProductDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Product Detail Error]", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Not Available</h2>
        <p className="text-gray-500 mb-6">
          We couldn&apos;t load this product. It may have been removed or there was a temporary issue.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            Retry
          </button>
          <Link
            href="/products"
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  )
}