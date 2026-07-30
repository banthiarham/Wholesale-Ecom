"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Building2, User as UserIcon, Phone, Mail, FileBadge, MapPin, Package,
  Layers, Wallet, CalendarDays, MessageSquare, Paperclip, CheckCircle2,
  Loader2, ArrowRight, X, PackageOpen,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/Toast"

interface ProductLite {
  id: string
  title: string
  thumbnail: string | null
}

interface FormState {
  companyName: string
  contactPerson: string
  mobileNumber: string
  email: string
  gstNumber: string
  businessAddress: string
  products: string
  quantity: string
  budget: string
  expectedDeliveryDate: string
  message: string
}

const EMPTY_FORM: FormState = {
  companyName: "",
  contactPerson: "",
  mobileNumber: "",
  email: "",
  gstNumber: "",
  businessAddress: "",
  products: "",
  quantity: "",
  budget: "",
  expectedDeliveryDate: "",
  message: "",
}

const REQUIRED_FIELDS: (keyof FormState)[] = [
  "companyName", "contactPerson", "mobileNumber", "email",
  "businessAddress", "products", "quantity", "budget", "expectedDeliveryDate", "message",
]

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"

export default function BulkOrdersPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ bulkOrderNumber: string } | null>(null)

  const [preselectedProduct, setPreselectedProduct] = useState<ProductLite | null>(null)
  const [productId, setProductId] = useState<string | null>(null)

  // Pre-fill from ?productId= when arriving via a product page's "Request Bulk Quote" button.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get("productId")
    if (!pid) return
    setProductId(pid)
    fetch(`/api/products?ids=${pid}&limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const product = data?.products?.[0]
        if (product?.id) {
          setPreselectedProduct({ id: product.id, title: product.title, thumbnail: product.thumbnail || product.images?.[0] || null })
          setForm((f) => ({ ...f, products: product.title }))
        }
      })
      .catch(() => {})
  }, [])

  // Prefill contact details for logged-in users.
  useEffect(() => {
    if (!user) return
    setForm((f) => ({
      ...f,
      contactPerson: f.contactPerson || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: f.email || user.email || "",
      companyName: f.companyName || (user as any).companyName || "",
      mobileNumber: f.mobileNumber || (user as any).phone || "",
    }))
  }, [user])

  const update = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const clearProduct = () => {
    setPreselectedProduct(null)
    setProductId(null)
    setForm((f) => ({ ...f, products: "" }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFileError("")
    if (!f) { setFile(null); return }
    if (f.size > MAX_FILE_BYTES) {
      setFileError("File must be 5MB or smaller")
      setFile(null)
      e.target.value = ""
      return
    }
    setFile(f)
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    for (const field of REQUIRED_FIELDS) {
      if (!form[field].trim()) next[field] = "This field is required"
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address"
    }
    if (form.mobileNumber && !/^[\d+\s()-]{7,}$/.test(form.mobileNumber)) {
      next.mobileNumber = "Enter a valid mobile number"
    }
    if (form.expectedDeliveryDate) {
      const picked = new Date(form.expectedDeliveryDate)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (picked < today) next.expectedDeliveryDate = "Delivery date can't be in the past"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      showToast("error", "Please fix the highlighted fields")
      return
    }

    setSubmitting(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => body.append(key, value))
      if (productId) body.append("productId", productId)
      if (file) body.append("attachment", file)

      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("/api/bulk-orders", { method: "POST", headers, body })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setSubmitted({ bulkOrderNumber: data.bulkOrder?.bulkOrderNumber || "" })
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
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center card-base-static p-8 sm:p-12 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h1 className="heading-lg mb-3">Request Submitted!</h1>
          <p className="body-lg mb-6">
            Thank you. Our wholesale team has received your bulk order request and will get back to you shortly with a quotation.
          </p>
          {submitted.bulkOrderNumber && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 border border-primary-100 mb-8">
              <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Reference ID</span>
              <span className="text-sm font-bold text-primary-800">{submitted.bulkOrderNumber}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/products" className="btn-primary">Continue Browsing</Link>
            <Link href="/" className="btn-outline">Back to Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="section-container py-10 lg:py-14">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-10">
          <span className="eyebrow justify-center">B2B Wholesale</span>
          <h1 className="heading-xl mb-3">Request a Bulk Order Quote</h1>
          <p className="body-lg">
            Tell us what your business needs and our wholesale team will get back to you with tailored pricing,
            typically within 1-2 business days.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto card-base-static p-6 sm:p-8 lg:p-10 space-y-8 animate-fade-in-up">
          {/* Preselected product banner */}
          {preselectedProduct && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary-50 border border-primary-100">
              {preselectedProduct.thumbnail ? (
                <img src={preselectedProduct.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-primary-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide">Quote requested for</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{preselectedProduct.title}</p>
              </div>
              <button type="button" onClick={clearProduct} className="p-1.5 text-primary-400 hover:text-primary-700 hover:bg-white rounded-lg transition-colors" aria-label="Remove product">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Company details */}
          <fieldset className="space-y-4">
            <legend className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1">
              <Building2 size={16} className="text-primary-600" /> Company Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company Name" error={errors.companyName} required>
                <Input icon={Building2} value={form.companyName} onChange={(v) => update("companyName", v)} placeholder="Acme Wholesale Pvt. Ltd." error={!!errors.companyName} />
              </Field>
              <Field label="GST Number" hint="Optional">
                <Input icon={FileBadge} value={form.gstNumber} onChange={(v) => update("gstNumber", v)} placeholder="22AAAAA0000A1Z5" />
              </Field>
            </div>
            <Field label="Business Address" error={errors.businessAddress} required>
              <TextArea icon={MapPin} value={form.businessAddress} onChange={(v) => update("businessAddress", v)} placeholder="Warehouse / office address with city, state and PIN code" error={!!errors.businessAddress} rows={2} />
            </Field>
          </fieldset>

          {/* Contact details */}
          <fieldset className="space-y-4">
            <legend className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1">
              <UserIcon size={16} className="text-primary-600" /> Contact Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Person" error={errors.contactPerson} required>
                <Input icon={UserIcon} value={form.contactPerson} onChange={(v) => update("contactPerson", v)} placeholder="Full name" error={!!errors.contactPerson} />
              </Field>
              <Field label="Mobile Number" error={errors.mobileNumber} required>
                <Input icon={Phone} type="tel" value={form.mobileNumber} onChange={(v) => update("mobileNumber", v)} placeholder="+91 98765 43210" error={!!errors.mobileNumber} />
              </Field>
            </div>
            <Field label="Email Address" error={errors.email} required>
              <Input icon={Mail} type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="you@company.com" error={!!errors.email} />
            </Field>
          </fieldset>

          {/* Requirement details */}
          <fieldset className="space-y-4">
            <legend className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1">
              <PackageOpen size={16} className="text-primary-600" /> Requirement Details
            </legend>
            <Field label="Product(s)" error={errors.products} required hint="List the product(s) you'd like to order in bulk">
              <TextArea icon={Package} value={form.products} onChange={(v) => update("products", v)} placeholder="e.g. Multivitamin Tablets (60ct), Electric Toothbrush Pack" error={!!errors.products} rows={2} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Required Quantity" error={errors.quantity} required>
                <Input icon={Layers} value={form.quantity} onChange={(v) => update("quantity", v)} placeholder="e.g. 5,000 units" error={!!errors.quantity} />
              </Field>
              <Field label="Expected Budget" error={errors.budget} required>
                <Input icon={Wallet} value={form.budget} onChange={(v) => update("budget", v)} placeholder="e.g. ₹1,00,000 - ₹2,00,000" error={!!errors.budget} />
              </Field>
            </div>
            <Field label="Expected Delivery Date" error={errors.expectedDeliveryDate} required>
              <Input icon={CalendarDays} type="date" value={form.expectedDeliveryDate} onChange={(v) => update("expectedDeliveryDate", v)} error={!!errors.expectedDeliveryDate} min={new Date().toISOString().split("T")[0]} />
            </Field>
            <Field label="Message / Special Requirements" error={errors.message} required>
              <TextArea icon={MessageSquare} value={form.message} onChange={(v) => update("message", v)} placeholder="Packaging preferences, customization, delivery instructions, etc." error={!!errors.message} rows={3} />
            </Field>
            <Field label="File Attachment" hint="Optional — spec sheet, PO, or reference document (PDF, DOC, XLS, JPG, PNG — max 5MB)">
              <label className="flex items-center gap-3 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:bg-primary-50/40 cursor-pointer transition-all duration-200">
                <Paperclip size={16} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate">{file ? file.name : "Choose a file..."}</span>
                <span className="text-xs font-semibold text-primary-600 flex-shrink-0">Browse</span>
                <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleFileChange} className="hidden" />
              </label>
              {fileError && <p className="text-xs text-red-500 mt-1.5">{fileError}</p>}
            </Field>
          </fieldset>

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center gap-2 text-base py-3.5">
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Submitting...</>
            ) : (
              <>Submit Request <ArrowRight size={18} /></>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center -mt-4">
            By submitting, you agree to be contacted by our wholesale team regarding this request.
          </p>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Field primitives                                                   */
/* ------------------------------------------------------------------ */

function Field({ label, error, hint, required, children }: { label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps {
  icon: any
  error?: boolean
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  min?: string
}

function Input({ icon: Icon, error, onChange, value, ...rest }: InputProps) {
  return (
    <div className="relative">
      <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        {...rest}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${error ? "border-red-300 focus:ring-red-400" : "border-gray-200 focus:ring-primary-500 focus:border-transparent"}`}
      />
    </div>
  )
}

interface TextAreaProps {
  icon: any
  error?: boolean
  rows?: number
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function TextArea({ icon: Icon, error, rows = 3, onChange, value, ...rest }: TextAreaProps) {
  return (
    <div className="relative">
      <Icon size={16} className="absolute left-3.5 top-3 text-gray-400" />
      <textarea
        {...rest}
        rows={rows}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 resize-none ${error ? "border-red-300 focus:ring-red-400" : "border-gray-200 focus:ring-primary-500 focus:border-transparent"}`}
      />
    </div>
  )
}
