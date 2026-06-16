"use client"

import { useState, useEffect } from "react"
import { getContrastTextColor } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, User, Phone, Shield, Check } from "lucide-react"

interface SelectableRole {
  id: string
  name: string
  label: string
  description: string | null
  color: string | null
  icon: string | null
  isSystem: boolean
}

export default function RegisterPage() {
  const router = useRouter()
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

  const selectedRole = roles.find((r) => r.id === form.roleId)

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
        router.push(`/verify-otp?email=${encodeURIComponent(form.email)}`)
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-primary-700 mb-2">WholesaleX Pro</div>
          <p className="text-gray-600">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="John" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Doe" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="email" name="email" value={form.email} onChange={handleChange} required className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="+91 98765 43210" />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Your Account Type
              </label>
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
                      className={`relative flex items-start gap-3 p-4 rounded-lg border-2 transition text-left ${
                        form.roleId === role.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {/* Radio indicator */}
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        form.roleId === role.id
                          ? "border-primary-500 bg-primary-500"
                          : "border-gray-300 bg-white"
                      }`}>
                        {form.roleId === role.id && <Check size={12} className="text-white" />}
                      </div>

                      {/* Role icon & info */}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} required className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading || !form.roleId} className="w-full mt-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium">
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {selectedRole && selectedRole.name !== "BUYER" && (
            <p className="mt-3 text-xs text-center text-gray-500">
              Your account will need admin approval for the <span className="font-medium" style={{ color: selectedRole.color || "#6B7280" }}>{selectedRole.label}</span> role.
              You&apos;ll start with Buyer access and be upgraded after approval.
            </p>
          )}
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}