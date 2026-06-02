"use client"

import { useEffect } from "react"

export default function CatalogsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Catalogs Error]", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Catalogs Error</h2>
        <p className="text-gray-500 mb-6">
          We couldn&apos;t load the catalogs. Please try again.
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