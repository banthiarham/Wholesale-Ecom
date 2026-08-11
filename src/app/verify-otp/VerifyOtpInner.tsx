"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle, Shield } from "lucide-react"

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyOtpInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailFromQuery = searchParams.get("email") || ""

  const [email, setEmail] = useState(emailFromQuery)
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [verified, setVerified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery)
  }, [emailFromQuery])

  // Arriving here straight from signup means an OTP was already just sent —
  // start the resend button on cooldown so it can't be spammed immediately.
  useEffect(() => {
    if (emailFromQuery) setCooldown(RESEND_COOLDOWN_SECONDS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    setResendMessage("")
    setError("")

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Could not resend OTP")
      } else {
        setResendMessage(data.message || "A new OTP has been sent to your email")
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Invalid OTP")
      } else {
        setVerified(true)
      }
    } catch {
      setError("Something went wrong")
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify your email</h1>
          <p className="text-gray-500 text-sm">Enter the code we sent you</p>
        </div>

        <div className="card-base-static p-8">
          {verified ? (
            <div className="text-center py-4">
              <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Email verified</h2>
              <p className="text-sm text-gray-600 mb-4">Your account is now active. You can sign in.</p>
              <Link href="/login" className="text-primary-600 hover:underline text-sm">Go to sign in</Link>
            </div>
          ) : (
            <>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}
              {resendMessage && <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm">{resendMessage}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-base"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">OTP Code</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      maxLength={6}
                      className="input-base pl-9 tracking-widest"
                      placeholder="123456"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? "Verifying..." : "Verify Email"}
                </button>
              </form>

              <div className="mt-4 text-center text-sm text-gray-500">
                Didn&apos;t get the code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending || !email}
                  className="text-primary-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resending ? "Sending..." : cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
                </button>
              </div>

              <div className="mt-6">
                <Link href="/login" className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600 transition-colors">
                  <ArrowLeft size={14} /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
