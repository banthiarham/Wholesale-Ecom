"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Package, Plus, Minus, Trash2, Search, Loader2, ArrowRight, FileText,
  CheckCircle2, X, Building2, Phone, Mail, MapPin, CalendarDays, FileBadge,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/Toast"
import { formatPrice } from "@/lib/utils"

interface ProductLite {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  sku: string | null
  unitPrice: number | string
  moq: number
}

interface OrderRow {
  key: string
  query: string
  showDropdown: boolean
  searching: boolean
  results: ProductLite[]
  product: ProductLite | null
  quantity: number
  finalPrice: number | null
  pricingLoading: boolean
}

let rowCounter = 0
const newRow = (): OrderRow => ({
  key: `row-${++rowCounter}`,
  query: "",
  showDropdown: false,
  searching: false,
  results: [],
  product: null,
  quantity: 1,
  finalPrice: null,
  pricingLoading: false,
})

export default function BulkOrdersPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [rows, setRows] = useState<OrderRow[]>(() => [newRow()])
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const priceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Bulk orders submitted here go through the same admin-approval flow as
  // /bulk-orders/request (POST /bulk-orders → PENDING → admin Approve/Reject/Comment) —
  // they are never added to the cart or checked out directly. This modal collects the
  // few contact/business fields the request API requires that aren't already captured
  // by the product/quantity picker above.
  const [showConfirm, setShowConfirm] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [email, setEmail] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [businessAddress, setBusinessAddress] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (user) {
      setContactPerson(`${user.firstName || ""} ${user.lastName || ""}`.trim())
      setEmail(user.email || "")
      if ((user as any).companyName) setCompanyName((user as any).companyName)
    }
  }, [user])

  // Pre-fill the first row from ?productId= when arriving via a product page's "Order in Bulk" button.
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("productId")
    if (!pid) return
    fetch(`/api/products?ids=${pid}&limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const product = data?.products?.[0]
        if (product?.id) {
          setRows((prev) => {
            const [first, ...rest] = prev
            return [{ ...first, product, query: product.title, quantity: product.moq || 1 }, ...rest]
          })
          fetchPrice(rows[0].key, product.id, product.moq || 1)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchRow = (key: string, patch: Partial<OrderRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addRow = () => setRows((prev) => [...prev, newRow()])

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((r) => r.key !== key)))
  }

  const searchProducts = (key: string, query: string) => {
    patchRow(key, { query, showDropdown: true })
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key])
    patchRow(key, { searching: true })
    searchTimers.current[key] = setTimeout(async () => {
      try {
        const url = query.trim()
          ? `/api/products?q=${encodeURIComponent(query)}&limit=20`
          : `/api/products?limit=20`
        const res = await fetch(url)
        const data = await res.json().catch(() => ({}))
        patchRow(key, { results: data.products || [], searching: false })
      } catch {
        patchRow(key, { results: [], searching: false })
      }
    }, query.trim() ? 300 : 0)
  }

  const selectProduct = (key: string, product: ProductLite) => {
    patchRow(key, {
      product,
      query: product.title,
      showDropdown: false,
      results: [],
      quantity: product.moq || 1,
    })
    fetchPrice(key, product.id, product.moq || 1)
  }

  const fetchPrice = (key: string, productId: string, quantity: number) => {
    if (priceTimers.current[key]) clearTimeout(priceTimers.current[key])
    patchRow(key, { pricingLoading: true })
    priceTimers.current[key] = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ productId, quantity: String(quantity) })
        if (user?.id) params.set("userId", user.id)
        const res = await fetch(`/api/pricing/calculate?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        patchRow(key, { finalPrice: typeof data.finalPrice === "number" ? data.finalPrice : null, pricingLoading: false })
      } catch {
        patchRow(key, { finalPrice: null, pricingLoading: false })
      }
    }, 250)
  }

  const updateQuantity = (row: OrderRow, quantity: number) => {
    const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
    patchRow(row.key, { quantity: safeQty })
    if (row.product) fetchPrice(row.key, row.product.id, safeQty)
  }

  useEffect(() => {
    return () => {
      Object.values(searchTimers.current).forEach(clearTimeout)
      Object.values(priceTimers.current).forEach(clearTimeout)
    }
  }, [])

  const validRows = rows.filter((r) => r.product && r.quantity > 0)
  const grandTotal = validRows.reduce(
    (sum, r) => sum + (r.finalPrice ?? Number(r.product!.unitPrice)) * r.quantity,
    0
  )

  const openConfirm = () => {
    if (validRows.length === 0) {
      showToast("error", "Add at least one product to your order")
      return
    }
    const belowMoq = validRows.find((r) => r.quantity < (r.product?.moq || 1))
    if (belowMoq) {
      showToast("error", `${belowMoq.product?.title}: minimum order quantity is ${belowMoq.product?.moq}`)
      return
    }
    setShowConfirm(true)
  }

  const isConfirmValid =
    companyName.trim() && contactPerson.trim() && mobileNumber.trim() && email.trim() &&
    businessAddress.trim() && expectedDeliveryDate

  // Submits a BulkOrder request (PENDING, awaiting admin Approve/Reject/Comment) —
  // the same POST /bulk-orders API and CreateBulkOrderDto used by /bulk-orders/request.
  // Nothing is added to the cart and no Order is created at this stage.
  const handleSubmitRequest = async () => {
    if (!isConfirmValid) {
      showToast("error", "Please fill in all required fields")
      return
    }
    setSubmitting(true)
    try {
      const productsSummary = validRows.map((r) => `${r.product!.title} x ${r.quantity}`).join(", ")
      const quantitySummary = validRows.map((r) => `${r.quantity} unit(s) of ${r.product!.title}`).join("; ")

      const form = new FormData()
      form.append("companyName", companyName.trim())
      form.append("contactPerson", contactPerson.trim())
      form.append("mobileNumber", mobileNumber.trim())
      form.append("email", email.trim())
      if (gstNumber.trim()) form.append("gstNumber", gstNumber.trim())
      form.append("businessAddress", businessAddress.trim())
      form.append("productId", validRows[0].product!.id)
      form.append("products", productsSummary)
      form.append("quantity", quantitySummary)
      form.append("budget", formatPrice(grandTotal))
      form.append("expectedDeliveryDate", new Date(expectedDeliveryDate).toISOString())
      form.append("message", `Bulk order request submitted via the product selector. Items: ${productsSummary}. Estimated total: ${formatPrice(grandTotal)}.`)

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("/api/bulk-orders", { method: "POST", headers, body: form })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowConfirm(false)
        setSubmitted(true)
      } else {
        showToast("error", data.message || "Could not submit your bulk order request")
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
          <h1 className="heading-md mb-2">Bulk Order Submitted</h1>
          <p className="body-sm mb-6">
            Your bulk order is now pending admin approval. We&apos;ll notify you once it&apos;s reviewed.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/bulk-orders/my-requests" className="btn-primary justify-center">
              View My Bulk Orders
            </Link>
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
      <div className="section-container py-10 lg:py-14">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <span className="eyebrow justify-center">B2B Wholesale</span>
          <h1 className="heading-xl mb-3">Place a Bulk Order</h1>
          <p className="body-lg">
            Pick your products, enter the quantity you need for each, and we'll calculate wholesale pricing
            automatically. Add as many products as you like, then place your order.
          </p>
          <p className="text-sm text-gray-500 mt-3">
            Need custom terms or a large one-off order instead?{" "}
            <Link href="/bulk-orders/request" className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700">
              <FileText size={14} /> Request a bulk quote
            </Link>
          </p>
        </div>

        <div className="max-w-3xl mx-auto card-base-static p-6 sm:p-8 lg:p-10 space-y-6 animate-fade-in-up">
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.key} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 relative">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Product</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={row.query}
                        onChange={(e) => {
                          if (row.product) patchRow(row.key, { product: null, finalPrice: null })
                          searchProducts(row.key, e.target.value)
                        }}
                        onFocus={() => searchProducts(row.key, row.query)}
                        onBlur={() => setTimeout(() => patchRow(row.key, { showDropdown: false }), 150)}
                        placeholder="Search products by name or SKU..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    {row.showDropdown && (
                      <div className="absolute z-20 mt-1.5 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                        {row.searching ? (
                          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" /> Searching...
                          </div>
                        ) : row.results.length === 0 ? (
                          <div className="py-4 text-center text-sm text-gray-400">No products found</div>
                        ) : (
                          row.results.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); selectProduct(row.key, p) }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-primary-50 text-left transition-colors"
                            >
                              {p.thumbnail ? (
                                <img src={p.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Package size={14} className="text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                                <p className="text-xs text-gray-400">
                                  {p.sku ? `SKU: ${p.sku} · ` : ""}MOQ {p.moq} · {formatPrice(p.unitPrice)}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="w-32 flex-shrink-0">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quantity</label>
                    <div className={`flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden ${!row.product ? "opacity-50" : ""}`}>
                      <button
                        type="button"
                        onClick={() => updateQuantity(row, row.quantity - 1)}
                        disabled={!row.product || row.quantity <= (row.product?.moq || 1)}
                        className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min={row.product?.moq || 1}
                        value={row.quantity}
                        disabled={!row.product}
                        onChange={(e) => updateQuantity(row, parseInt(e.target.value, 10))}
                        className="w-full min-w-0 px-1 py-2.5 border-0 text-center text-sm bg-transparent text-gray-900 focus:outline-none focus:ring-0 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(row, row.quantity + 1)}
                        disabled={!row.product}
                        className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="w-32 flex-shrink-0">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount</label>
                    <div className="px-3 py-2.5 rounded-xl bg-white border border-gray-100 text-sm font-semibold text-gray-900 flex items-center h-[42px]">
                      {!row.product ? (
                        <span className="text-gray-300">—</span>
                      ) : row.pricingLoading ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        formatPrice((row.finalPrice ?? Number(row.product.unitPrice)) * row.quantity)
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="mt-6 p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0"
                    aria-label="Remove product"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/40 transition-all"
          >
            <Plus size={16} /> Add Another Product
          </button>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimated Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(grandTotal)}</p>
            </div>
            <button
              type="button"
              onClick={openConfirm}
              disabled={validRows.length === 0}
              className="btn-primary gap-2 text-base px-6 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={18} /> Submit Bulk Order Request <ArrowRight size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            This submits a bulk order request for admin approval — nothing is charged or added to your cart. You&apos;ll see the status under My Bulk Orders.
          </p>
        </div>
      </div>

      {/* Confirm & contact-details modal — collects the fields the admin-approval
          request needs that aren't already captured by the product/quantity picker. */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setShowConfirm(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Bulk Order Request</h3>
              <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Items ({validRows.length})</p>
                {validRows.map((r) => (
                  <div key={r.key} className="flex justify-between text-gray-700">
                    <span className="truncate pr-2">{r.product!.title} × {r.quantity}</span>
                    <span className="font-medium shrink-0">{formatPrice((r.finalPrice ?? Number(r.product!.unitPrice)) * r.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 mt-1.5 border-t border-gray-200 font-semibold text-gray-900">
                  <span>Estimated Total</span>
                  <span>{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ConfirmField icon={Building2} label="Company Name" required>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-base" placeholder="Acme Traders" />
                </ConfirmField>
                <ConfirmField icon={FileBadge} label="GST Number">
                  <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="input-base" placeholder="Optional" />
                </ConfirmField>
                <ConfirmField icon={Mail} label="Contact Person" required>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-base" placeholder="Your name" />
                </ConfirmField>
                <ConfirmField icon={Phone} label="Mobile Number" required>
                  <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="input-base" placeholder="+91 98765 43210" />
                </ConfirmField>
                <ConfirmField icon={Mail} label="Email" required>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" placeholder="you@company.com" />
                </ConfirmField>
                <ConfirmField icon={CalendarDays} label="Expected Delivery Date" required>
                  <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="input-base" min={new Date().toISOString().split("T")[0]} />
                </ConfirmField>
                <ConfirmField icon={MapPin} label="Business Address" required full>
                  <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="input-base" placeholder="City, State" />
                </ConfirmField>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowConfirm(false)} disabled={submitting} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting || !isConfirmValid}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfirmField({
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
