"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      localStorage.setItem("token", token)
      const sessionId = localStorage.getItem("cart_session")
      if (sessionId) {
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => res.json())
          .then((userData) => {
            const userId = userData.id || userData.user?.id
            // Dispatch auth-change so AuthProvider picks up the new user
            window.dispatchEvent(new CustomEvent("auth-change", { detail: userData.user || userData }))
            if (userId) {
              fetch("/api/cart/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ sessionId }),
              })
                .then(() => localStorage.removeItem("cart_session"))
                .catch((err) => { console.error("Cart merge failed:", err) })
            }
          })
          .catch((err) => { console.error("Auth operation failed:", err) })
      } else {
        // No cart to merge, but still dispatch auth-change
        window.dispatchEvent(new CustomEvent("auth-change", { detail: null }))
      }
      router.push("/")
    } else {
      router.push("/login?error=auth_failed")
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )
}
