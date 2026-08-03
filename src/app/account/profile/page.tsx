"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User as UserIcon, Building2, Mail } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/Toast"
import { getContrastTextColor } from "@/lib/utils"

// Self-service profile fields only — deliberately excludes role/roleId/status,
// which are admin-managed and must never be settable from this form.
interface ProfileForm {
  firstName: string
  lastName: string
  phone: string
  companyName: string
  companyAddress: string
  taxId: string
}

const emptyForm: ProfileForm = { firstName: "", lastName: "", phone: "", companyName: "", companyAddress: "", taxId: "" }

export default function ProfilePage() {
  const router = useRouter()
  const { user, role, loading: authLoading, refresh } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (authLoading) return
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) { router.push("/login"); return }
    if (user) {
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        companyName: user.companyName || "",
        companyAddress: user.companyAddress || "",
        taxId: user.taxId || "",
      })
      setLoaded(true)
    }
  }, [authLoading, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem("token")
    if (!token) return
    setSaving(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
          companyAddress: form.companyAddress.trim() || undefined,
          taxId: form.taxId.trim() || undefined,
        }),
      })
      if (res.ok) {
        showToast("success", "Profile updated successfully")
        await refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast("error", data.message || "Could not update profile")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !loaded) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container max-w-3xl py-8">
        <span className="eyebrow">Account</span>
        <h1 className="heading-xl mb-6">My Profile</h1>

        {/* Identity card */}
        <div className="card-base-static p-6 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-primary-600">{form.firstName?.[0]?.toUpperCase() || "U"}</span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 truncate">{form.firstName} {form.lastName}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 truncate"><Mail size={13} /> {user?.email}</p>
            {role && (
              <span
                className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md"
                style={{ backgroundColor: role.color || "#6B7280", color: getContrastTextColor(role.color || "#6B7280") }}
              >
                {role.label || role.name}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal info */}
          <div className="card-base-static p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <UserIcon className="text-primary-600" size={19} />
              <h2 className="font-bold text-gray-900">Personal Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                <input type="text" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input type="text" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={user?.email || ""} disabled className="input-base bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-base" />
              </div>
            </div>
          </div>

          {/* Business info */}
          <div className="card-base-static p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <Building2 className="text-primary-600" size={19} />
              <h2 className="font-bold text-gray-900">Business Information <span className="text-gray-400 font-normal">(optional)</span></h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company Address</label>
                <input type="text" value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tax ID / GSTIN</label>
                <input type="text" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="input-base" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </main>
    </div>
  )
}
