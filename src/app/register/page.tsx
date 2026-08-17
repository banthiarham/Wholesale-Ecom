"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, User, Phone, Building2, ArrowLeft, ChevronRight } from "lucide-react"
import { INDIAN_STATES } from "@/lib/indian-address"

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

// The backend's legacy `role` column is a fixed enum (BUYER/VENDOR/DISTRIBUTOR/ADMIN) kept
// only for backward compatibility — dynamic roles like DEALER aren't members of it and the
// API rejects any other value there. `roleId` is what actually assigns the role; `role` is
// only ever sent when it happens to match one of these, otherwise omitted so the backend
// falls back to its own BUYER default for that column while roleId carries the real role.
const LEGACY_ROLE_ENUM = ["BUYER", "VENDOR", "DISTRIBUTOR", "ADMIN"]

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const PINCODE_REGEX = /^[1-9][0-9]{5}$/
const MOBILE_REGEX = /^[6-9]\d{9}$/

const DEFAULT_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  roleId: "",
  // Dealer / B2B-only fields
  companyName: "",
  gstin: "",
  panNumber: "",
  contactPersonName: "",
  companyAddress: "",
  pincode: "",
  city: "",
  state: "",
}

export default function RegisterPage() {
  const router = useRouter()
  const [signupType, setSignupType] = useState<SignupType>(null)
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [roles, setRoles] = useState<SelectableRole[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/roles/public")
      .then((res) => res.json())
      .then((data) => setRoles(data.roles || []))
      .catch(() => setRoles([]))
  }, [])

  // Customer signups always get BUYER; Dealer/B2B signups always get the DEALER role
  // (falls back to BUYER if that role is ever renamed/removed, so the form can't get
  // stuck with no role selected) — there's no picker anymore, so this runs whenever the
  // signup type is chosen or the role list finishes loading, whichever comes later.
  useEffect(() => {
    if (!roles.length || !signupType) return
    const targetRoleName = signupType === "buyer" ? "BUYER" : "DEALER"
    const targetRole = roles.find((r) => r.name === targetRoleName) || roles.find((r) => r.name === "BUYER")
    if (targetRole) setForm((prev) => ({ ...prev, roleId: targetRole.id }))
  }, [roles, signupType])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const selectedRole = roles.find((r) => r.id === form.roleId)

  const chooseBuyer = () => {
    setError("")
    setSignupType("buyer")
  }

  // Only runs for the Dealer / B2B form — the Customer flow never touches these fields,
  // so it can't be affected by this validation.
  const validateDealerFields = (): string | null => {
    if (!form.companyName.trim()) return "Company Name is required"
    if (!GSTIN_REGEX.test(form.gstin.trim().toUpperCase())) return "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)"
    if (!PAN_REGEX.test(form.panNumber.trim().toUpperCase())) return "Enter a valid 10-character PAN (e.g. ABCDE1234F)"
    if (!form.contactPersonName.trim()) return "Contact Person Name is required"
    if (!MOBILE_REGEX.test(form.phone.trim())) return "Enter a valid 10-digit mobile number"
    if (!form.companyAddress.trim()) return "Full Address is required"
    if (!PINCODE_REGEX.test(form.pincode.trim())) return "Enter a valid 6-digit pincode"
    if (!form.city.trim()) return "City is required"
    if (!form.state.trim()) return "State is required"
    return null
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
    if (signupType === "b2b") {
      const dealerError = validateDealerFields()
      if (dealerError) {
        setError(dealerError)
        return
      }
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
          ...(selectedRole && LEGACY_ROLE_ENUM.includes(selectedRole.name) && { role: selectedRole.name }),
          roleId: form.roleId,
          accountCategory: signupType === "b2b" ? "DEALER" : "CUSTOMER",
          ...(signupType === "b2b" && {
            companyName: form.companyName.trim(),
            gstin: form.gstin.trim().toUpperCase(),
            panNumber: form.panNumber.trim().toUpperCase(),
            contactPersonName: form.contactPersonName.trim(),
            companyAddress: form.companyAddress.trim(),
            pincode: form.pincode.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
          }),
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

  // Step 1: ask whether this is a quick Customer signup (preset to BUYER) or a Dealer / B2B
  // signup (preset to DEALER, subject to admin approval via the existing RoleChangeRequest
  // workflow — see the effect above). Everything below this gate reuses the same base form
  // and API call that already existed; this only decides whether the Dealer/B2B-only
  // business fields are shown.
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
                <div className="font-semibold text-gray-900">Customer</div>
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
                <div className="font-semibold text-gray-900">Dealer / B2B</div>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{signupType === "buyer" ? "Create your Customer account" : "Create your Dealer / B2B account"}</h1>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{signupType === "b2b" ? "Mobile Number" : "Phone"}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required={signupType === "b2b"}
                  pattern={signupType === "b2b" ? "[6-9][0-9]{9}" : undefined}
                  title={signupType === "b2b" ? "Enter a valid 10-digit mobile number" : undefined}
                  className="input-base pl-9"
                  placeholder={signupType === "b2b" ? "9876543210" : "+91 98765 43210"}
                />
              </div>
            </div>

            {/* Dealer / B2B business details — only shown for the B2B flow. All fields here
                are required and validated both client-side (above) and server-side
                (RegisterDto), and are saved on the user's profile alongside the existing
                companyName/companyAddress columns. */}
            {signupType === "b2b" && (
              <div className="space-y-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Business Details</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
                  <input type="text" name="companyName" value={form.companyName} onChange={handleChange} required className="input-base" placeholder="Acme Traders Pvt Ltd" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">GSTIN</label>
                    <input
                      type="text"
                      name="gstin"
                      value={form.gstin}
                      onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                      required
                      maxLength={15}
                      pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
                      title="Enter a valid 15-character GSTIN"
                      className="input-base uppercase"
                      placeholder="27ABCDE1234F1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">PAN Number</label>
                    <input
                      type="text"
                      name="panNumber"
                      value={form.panNumber}
                      onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                      required
                      maxLength={10}
                      pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                      title="Enter a valid 10-character PAN"
                      className="input-base uppercase"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Person Name</label>
                  <input type="text" name="contactPersonName" value={form.contactPersonName} onChange={handleChange} required className="input-base" placeholder="Ramesh Kumar" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Address</label>
                  <input type="text" name="companyAddress" value={form.companyAddress} onChange={handleChange} required className="input-base" placeholder="123 Industrial Area, Sector 5" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      required
                      maxLength={6}
                      pattern="[1-9][0-9]{5}"
                      title="Enter a valid 6-digit pincode"
                      className="input-base"
                      placeholder="400001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                    <input type="text" name="city" value={form.city} onChange={handleChange} required className="input-base" placeholder="Mumbai" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                  <input
                    type="text"
                    name="state"
                    list="indian-states"
                    value={form.state}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                    className="input-base"
                    placeholder="Search or select state"
                  />
                  <datalist id="indian-states">
                    {INDIAN_STATES.map((state) => <option key={state} value={state} />)}
                  </datalist>
                </div>
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
