"use client"

import { useEffect } from "react"

export default function LoyaltyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Loyalty Error]", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.403 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.403-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loyalty Error</h2>
        <p className="text-gray-500 mb-6">
          We couldn&apos;t load the loyalty program. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
        >
          Retry
        </button>
      </div>
    </div>
  )
}