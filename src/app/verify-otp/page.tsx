"use client"

import { Suspense } from "react"
import VerifyOtpInner from "./VerifyOtpInner"

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>}>
      <VerifyOtpInner />
    </Suspense>
  )
}
