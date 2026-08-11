"use client"

import { useState, useEffect } from "react"
import { getContrastTextColor } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, User, Phone, Shield, Check, Building2, ArrowLeft, ChevronRight } from "lucide-react"

interface SelectableRole {
  id: string
  name: string
  label: string
  description: string | null
  color: string | null
  icon: string | null
  isSystem: boolean
}

type SignupType = "buyer" | "b2b" | null

export default function RegisterPage() {
  const router = useRouter()
  const [signupType, setSignupType] = useState<SignupType>(null)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    roleId: "",
  })
  const [roles, setRoles] = useState<SelectableRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/roles/public")
      .then((res) => res.json())
      .then((data) => {
        setRoles(data.roles || [])
        // Default to BUYER role
        const buyerRole = (data.roles || []).find((r: SelectableRole) => r.name === "BUYER")
        if (buyerRole) setForm((prev) => ({ ...prev, roleId: buyerRole.id }))
      })
      .catch(() => setRoles([]))
      .finally(() => setLoadingRoles(false))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const buyerRole = roles.find((r) => r.name === "BUYER")
  const selectedRole = roles.find((r) => r.id === form.roleId)

  const chooseBuyer = () => {
    setError("")
    if (buyerRole) setForm((prev) => ({ ...prev, roleId: buyerRole.id }))
    setSignupType("buyer")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (!form.roleId) {
      setError("Please select a role")
      return
    }
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          role: selectedRole?.name || "BUYER",
          roleId: form.roleId,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Registration failed")
      } else {
        const emailSentParam = data.otpEmailSent ? "1" : "0"
        router.push(`/verify-otp?email=${encodeURIComponent(form.email)}&emailSent=${emailSentParam}`)
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // Step 1: ask whether this is a quick Buyer signup or a B2B signup (Vendor/Distributor/etc,
  // subject to admin approval). Everything below this gate reuses the exact same form,
  // API call, roles, and approval workflow that already existed — this only decides whether
  // the role picker is shown or the role is preset to BUYER.
  if (!signupType) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-500 text-sm">Join WholesaleX Pro today</p>
          </div>

          <div className="card-base-static p-6 space-y-3">
            <button
              type="button"
              onClick={chooseBuyer}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50/50 transition-all text-left group"
            >
              <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">Normal Buyer Signup</div>
                <p className="text-xs text-gray-500 mt-0.5">Shop and buy products right away — no approval needed.</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => { setError(""); setSignupType("b2b") }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50/50 transition-all text-left group"
            >
              <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                <Building2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">B2B Signup</div>
                <p className="text-xs text-gray-500 mt-0.5">Register as Vendor, Distributor, Wholesaler &amp; more — subject to admin approval.</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
            </button>
          </div>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{signupType === "buyer" ? "Create your buyer account" : "B2B account signup"}</h1>
          <p className="text-gray-500 text-sm">Join WholesaleX Pro today</p>
        </div>

        <form onSubmit={handleSubmit} className="card-base-static p-8">
          <button
            type="button"
            onClick={() => setSignupType(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-4"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required className="input-base pl-9" placeholder="John" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required className="input-base" placeholder="Doe" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="email" name="email" value={form.email} onChange={handleChange} required className="input-base pl-9" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="input-base pl-9" placeholder="+91 98765 43210" />
              </div>
            </div>

            {/* Role Selection — only shown for the B2B flow; Normal Buyer signup keeps the
                role preset to BUYER (set in chooseBuyer()) and skips this picker entirely. */}
            {signupType === "b2b" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Choose Your Account Type</label>
                {loadingRoles ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, roleId: role.id }))}
                        className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                          form.roleId === role.id
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          form.roleId === role.id
                            ? "border-primary-500 bg-primary-500"
                            : "border-gray-300 bg-white"
                        }`}>
                          {form.roleId === role.id && <Check size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: role.color || "#6B7280", color: getContrastTextColor(role.color || "#6B7280") }}
                            >
                              <Shield size={14} />
                            </div>
                            <span className="font-medium text-gray-900">{role.label}</span>
                            {role.isSystem && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">DEFAULT</span>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-xs text-gray-500 mt-1 ml-9">{role.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} required className="input-base pl-9 pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required className="input-base" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading || !form.roleId} className="btn-primary w-full mt-6 justify-center">
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {signupType === "b2b" && selectedRole && selectedRole.name !== "BUYER" && (
            <p className="mt-3 text-xs text-center text-gray-500">
              Your account will need admin approval for the <span className="font-medium" style={{ color: selectedRole.color || "#6B7280" }}>{selectedRole.label}</span> role.
              You&apos;ll start with Buyer access and be upgraded after approval.
            </p>
          )}
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
