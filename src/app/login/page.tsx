"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const responseText = await res.text()
      let data: any = {}
      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          // Next.js returns plain text when its backend rewrite target is offline.
          // Keep handling the HTTP status below instead of masking it as a JSON error.
        }
      }

      if (!res.ok) {
        setError(
          data.message ||
          (res.status >= 500
            ? "The server is unavailable. Please start the backend and try again."
            : "Unable to sign in. Please check your credentials.")
        )
      } else {
        const token = data.accessToken || data.access_token
        localStorage.setItem("token", token)
        const sessionId = localStorage.getItem("cart_session")
        const userId = data.user?.id
        if (sessionId && userId) {
          try {
            await fetch("/api/cart/merge", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ sessionId, userId }),
            })
            localStorage.removeItem("cart_session")
          } catch (err) {
            console.error("Cart merge failed", err)
          }
        }
        // Dispatch auth-change so AuthProvider re-fetches user + permissions
        window.dispatchEvent(new CustomEvent("auth-change", { detail: data.user }))
        // Wait briefly for AuthProvider to fetch /api/auth/me with permissions
        // before redirecting (avoids race condition where admin page kicks you out)
        await new Promise((r) => setTimeout(r, 500))
        // Use dynamic role for redirect — effectiveRole from roleRel takes precedence
        const effectiveRole = data.user?.effectiveRole || data.user?.roleRel?.name || data.user?.role
        const redirectTo = effectiveRole === "ADMIN" ? "/admin" : effectiveRole === "VENDOR" ? "/vendor/dashboard" : "/"
        router.push(redirectTo)
      }
    } catch (err) {
      console.error("Login request failed", err)
      setError("Unable to connect to the server. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm">{t("login.title")}</p>
        </div>

        <form onSubmit={handleSubmit} className="card-base-static p-8">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("login.email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-base pl-9" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("login.password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="input-base pl-9 pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors">{t("login.forgot")}</Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-6 justify-center">
            {loading ? "Signing in..." : t("login.submit")}
          </button>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-400">Or continue with</span>
            </div>
          </div>

          <a
            href="/api/auth/google"
            className="w-full mt-4 flex items-center justify-center gap-2.5 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("login.google")}
          </a>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">{t("nav.signup")}</Link>
        </p>
      </div>
    </div>
  )
}
