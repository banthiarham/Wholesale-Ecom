"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function CategoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Categories Error]", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Categories Error</h2>
        <p className="text-gray-500 mb-6">
          We couldn&apos;t load the categories. Please try again.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}