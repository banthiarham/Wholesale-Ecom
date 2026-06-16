"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function PackageDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <AlertCircle size={48} className="text-red-400 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
      <p className="text-gray-500 mt-2 text-center">{error.message || "Failed to load this package."}</p>
      <div className="flex gap-3 mt-6">
        <button onClick={reset} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
          Retry
        </button>
        <Link href="/packages" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          All Packages
        </Link>
      </div>
    </div>
  )
}