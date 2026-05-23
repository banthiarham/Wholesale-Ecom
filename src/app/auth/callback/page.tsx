"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      localStorage.setItem("token", token)
      // Merge guest cart into user cart
      const sessionId = localStorage.getItem("cart_session")
      if (sessionId) {
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => res.json())
          .then((userData) => {
            const userId = userData.id || userData.user?.id
            if (userId) {
              return fetch("/api/cart/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ sessionId, userId }),
              })
            }
          })
          .then(() => localStorage.removeItem("cart_session"))
          .catch((err) => console.error("Cart merge failed", err))
          .finally(() => router.replace("/"))
      } else {
        router.replace("/")
      }
    } else {
      router.replace("/login")
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}
