"use client"

import { useEffect } from "react"

export default function CartError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Cart Error]", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Cart Error</h2>
        <p className="text-gray-500 mb-6">
          Something went wrong with your cart. Please try again.
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