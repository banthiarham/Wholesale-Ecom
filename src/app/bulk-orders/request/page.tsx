"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Building2, Phone, Mail, FileBadge, MapPin, Package,
  Layers, Wallet, CalendarDays, MessageSquare, Paperclip, Loader2, CheckCircle2,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/Toast"

export default function BulkOrderRequestPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  const [productId, setProductId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [email, setEmail] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [businessAddress, setBusinessAddress] = useState("")
  const [products, setProducts] = useState("")
  const [quantity, setQuantity] = useState("")
  const [budget, setBudget] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get("productId")
    if (pid) setProductId(pid)

    if (user) {
      setContactPerson(`${user.firstName || ""} ${user.lastName || ""}`.trim())
      setEmail(user.email || "")
      if (user.companyName) setCompanyName(user.companyName)
    }
  }, [user])

  const isValid =
    companyName.trim() && contactPerson.trim() && mobileNumber.trim() && email.trim() &&
    businessAddress.trim() && products.trim() && quantity.trim() && budget.trim() &&
    expectedDeliveryDate && message.trim()

  const handleSubmit = async () => {
    if (!isValid) {
      showToast("error", "Please fill in all required fields")
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append("companyName", companyName.trim())
      form.append("contactPerson", contactPerson.trim())
      form.append("mobileNumber", mobileNumber.trim())
      form.append("email", email.trim())
      if (gstNumber.trim()) form.append("gstNumber", gstNumber.trim())
      form.append("businessAddress", businessAddress.trim())
      if (productId) form.append("productId", productId)
      form.append("products", products.trim())
      form.append("quantity", quantity.trim())
      form.append("budget", budget.trim())
      form.append("expectedDeliveryDate", new Date(expectedDeliveryDate).toISOString())
      form.append("message", message.trim())
      if (attachment) form.append("attachment", attachment)

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("/api/bulk-orders", { method: "POST", headers, body: form })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitted(true)
      } else {
        showToast("error", data.message || "Could not submit your request")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center px-4">
        <div className="card-base-static p-8 sm:p-12 max-w-md w-full text-center animate-fade-in-up">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h1 className="heading-md mb-2">Request Submitted</h1>
          <p className="body-sm mb-6">
            Thanks — our team will review your bulk quote request and get back to you shortly.
          </p>
          <div className="flex flex-col gap-2">
            {user && (
              <Link href="/bulk-orders/my-requests" className="btn-primary justify-center">
                View My Requests
              </Link>
            )}
            <Link href="/" className="btn-outline justify-center">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <main className="section-container max-w-3xl py-8 lg:py-12">
        <Link href="/bulk-orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Bulk Orders
        </Link>
        <span className="eyebrow">B2B Wholesale</span>
        <h1 className="heading-xl mb-2">Request a Bulk Quote</h1>
        <p className="body-lg mb-6">
          Tell us what you need and your budget — our team will get back to you with custom wholesale pricing.
        </p>

        <div className="card-base-static p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field icon={Building2} label="Company Name" required>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-base" placeholder="Acme Traders" />
            </Field>
            <Field icon={FileBadge} label="GST Number">
              <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="input-base" placeholder="Optional" />
            </Field>
            <Field icon={Mail} label="Contact Person" required>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-base" placeholder="Your name" />
            </Field>
            <Field icon={Phone} label="Mobile Number" required>
              <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="input-base" placeholder="+91 98765 43210" />
            </Field>
            <Field icon={Mail} label="Email" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" placeholder="you@company.com" />
            </Field>
            <Field icon={MapPin} label="Business Address" required>
              <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="input-base" placeholder="City, State" />
            </Field>
          </div>

          <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field icon={Package} label="Product(s) Needed" required full>
              <input value={products} onChange={(e) => setProducts(e.target.value)} className="input-base" placeholder="e.g., Cotton T-Shirts, assorted sizes" />
            </Field>
            <Field icon={Layers} label="Required Quantity" required>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-base" placeholder="e.g., 500 units" />
            </Field>
            <Field icon={Wallet} label="Expected Budget" required>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} className="input-base" placeholder="e.g., ₹50,000" />
            </Field>
            <Field icon={CalendarDays} label="Expected Delivery Date" required full>
              <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="input-base" min={new Date().toISOString().split("T")[0]} />
            </Field>
            <Field icon={MessageSquare} label="Message / Special Requirements" required full>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="input-base resize-none" placeholder="Any special requirements, customization, packaging notes..." />
            </Field>
            <Field icon={Paperclip} label="Attachment (PDF, DOC, XLS, JPG, PNG — max 5MB)" full>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:text-sm file:font-medium hover:file:bg-primary-100"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className="btn-primary w-full justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : "Submit Request"}
          </button>
        </div>
      </main>
    </div>
  )
}

function Field({
  icon: Icon, label, required, full, children,
}: { icon: any; label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
        <Icon size={13} className="text-gray-400" /> {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
