"use client"

import { Suspense } from "react"
import AuthCallbackInner from "./AuthCallbackInner"

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>}>
      <AuthCallbackInner />
    </Suspense>
  )
}
