"use client"

import { Suspense } from "react"
import ResetPasswordInner from "./ResetPasswordInner"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}
