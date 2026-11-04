"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Search, Trash2, UserPlus, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { FormField } from "@/components/admin/FormField"

const inputCls = "px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full"

const BUILTIN_ROLE_OPTIONS = [
  { value: "enum:BUYER", label: "Buyer" },
  { value: "enum:VENDOR", label: "Vendor" },
  { value: "enum:DISTRIBUTOR", label: "Distributor" },
  { value: "enum:ADMIN", label: "Admin" },
]

const emptyAddress = { fullName: "", phone: "", email: "", street: "", apartment: "", landmark: "", city: "", state: "", zip: "", country: "India" }
type Address = typeof emptyAddress

interface Customer { id: string; firstName: string; lastName: string; email: string; phone?: string | null; companyName?: string | null }
interface ProductHit {
  id: string; title: string; sku: string | null; thumbnail: string | null; unitPrice: number; hasVariants: boolean; available: number
  variants: { id: string; sku: string; label: string; price: number; available: number }[]
}
interface Line {
  key: string
  id?: string
  productId: string
  title: string
  sku?: string | null
  variantId: string
  variants: ProductHit["variants"]
  hasVariants: boolean
  quantity: string
  unitPrice: string
  /** The admin typed this price, so role pricing must not overwrite it. */
  priceTouched?: boolean
  /** Units in stock when the line was added (unknown for lines loaded from an existing order — the server checks those). */
  available?: number
}

const num = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v))
const round2 = (n: number) => Math.round(n * 100) / 100
const customerName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim()
let keySeed = 0
const newKey = () => `l${++keySeed}`

function AddressForm({ value, onChange, errors }: { value: Address; onChange: (a: Address) => void; errors: Record<string, string> }) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value })
  const field = (k: keyof Address, label: string, required = true, span = "") => (
    <FormField label={label} required={required} className={span}>
      <input value={value[k]} onChange={set(k)} className={`${inputCls} ${errors[k] ? "!border-red-400" : ""}`} />
      {errors[k] && <p className="text-xs text-red-500">{errors[k]}</p>}
    </FormField>
  )
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {field("fullName", "Full name")}
      {field("phone", "Phone")}
      {field("email", "Email", false, "sm:col-span-2")}
      {field("street", "Street address", true, "sm:col-span-2")}
      {field("apartment", "Apartment / building", false)}
      {field("landmark", "Landmark", false)}
      {field("city", "City")}
      {field("state", "State")}
      {field("zip", "PIN / ZIP code")}
      {field("country", "Country")}
    </div>
  )
}

function validateAddress(a: Address): Record<string, string> {
  const e: Record<string, string> = {}
  if (!a.fullName.trim()) e.fullName = "Required"
  if (!/^\+?[\d\s-]{7,15}$/.test(a.phone.trim())) e.phone = "Enter a valid phone number"
  if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) e.email = "Enter a valid email"
  for (const k of ["street", "city", "state", "zip", "country"] as const) if (!a[k].trim()) e[k] = "Required"
  return e
}

const toAddress = (a: any): Address => ({
  ...emptyAddress,
  ...(a || {}),
  fullName: a?.fullName || a?.name || "",
  street: a?.street || a?.line1 || "",
  zip: a?.zip || a?.postalCode || "",
})

export default function OrderEditor({ order }: { order?: any }) {
  const router = useRouter()
  const isEdit = !!order
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""
  const auth = { Authorization: `Bearer ${token}` }

  // ── Customer ──
  const [customer, setCustomer] = useState<Customer | null>(order?.user ? { ...order.user, id: order.userId } : null)
  const [customerQuery, setCustomerQuery] = useState("")
  const [customerHits, setCustomerHits] = useState<Customer[]>([])
  const [customerOpen, setCustomerOpen] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [roles, setRoles] = useState<{ id: string; label: string }[]>([])
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "", email: "", role: "enum:BUYER" })
  const [newClientError, setNewClientError] = useState("")
  const [creatingClient, setCreatingClient] = useState(false)

  // ── Addresses ──
  const [shipping, setShipping] = useState<Address>(toAddress(order?.shippingAddress))
  const [billing, setBilling] = useState<Address>(toAddress(order?.billingAddress || order?.shippingAddress))
  const [sameBilling, setSameBilling] = useState(() => !order || JSON.stringify(toAddress(order.billingAddress || order.shippingAddress)) === JSON.stringify(toAddress(order.shippingAddress)))
  const [shipErrors, setShipErrors] = useState<Record<string, string>>({})
  const [billErrors, setBillErrors] = useState<Record<string, string>>({})

  // ── Lines ──
  const [lines, setLines] = useState<Line[]>(() =>
    (order?.items || []).map((i: any): Line => ({
      key: newKey(),
      id: i.id,
      productId: i.productId,
      // The API appends the variant to the title; show the bare product name and let the variant select carry it.
      title: i.metadata?.variant?.label ? String(i.product.title).replace(` (${i.metadata.variant.label})`, "") : i.product.title,
      sku: i.product.sku,
      variantId: i.variantId || "",
      variants: [],
      hasVariants: !!i.variantId,
      quantity: String(i.quantity),
      unitPrice: String(Number(i.unitPrice)),
    })),
  )
  const [productQuery, setProductQuery] = useState("")
  const [productHits, setProductHits] = useState<ProductHit[]>([])
  const [productOpen, setProductOpen] = useState(false)

  // ── Amounts ──
  const [discount, setDiscount] = useState(isEdit ? String(Number(order.discountAmount ?? 0)) : "0")
  const [shippingFee, setShippingFee] = useState(isEdit ? String(Number(order.shippingAmount ?? 0)) : "0")
  const [shippingTouched, setShippingTouched] = useState(isEdit)
  const [totalOverride, setTotalOverride] = useState<string | null>(null)
  const [notes, setNotes] = useState<string>(order?.notes || "")
  const [rates, setRates] = useState<{ cgst: number; sgst: number; igst: number }>(() => {
    const old = Number(order?.subtotal ?? 0)
    const r = (a: any) => (old > 0 ? (Number(a ?? 0) / old) * 100 : 0)
    return { cgst: r(order?.cgstAmount), sgst: r(order?.sgstAmount), igst: r(order?.igstAmount) }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Roles for the "new client" form.
  useEffect(() => {
    fetch("/api/roles", { headers: auth }).then((r) => r.json()).then((d) => setRoles(d.roles || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Existing orders: load each variant product's variants so the variant can still be switched.
  useEffect(() => {
    if (!isEdit) return
    const withVariant = lines.filter((l) => l.variantId)
    if (withVariant.length === 0) return
    ;(async () => {
      const cache = new Map<string, ProductHit["variants"]>()
      for (const l of withVariant) {
        if (cache.has(l.productId)) continue
        const res = await fetch(`/api/orders/admin/product-search?q=${encodeURIComponent(l.sku || l.title)}`, { headers: auth }).then((r) => r.json()).catch(() => null)
        const hit = (res?.products || []).find((p: ProductHit) => p.id === l.productId)
        if (hit) cache.set(l.productId, hit.variants)
      }
      setLines((prev) => prev.map((l) => (cache.has(l.productId) && l.variants.length === 0 ? { ...l, variants: cache.get(l.productId)! } : l)))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Customer search (debounced).
  useEffect(() => {
    if (isEdit || !customerOpen) return
    const t = setTimeout(() => {
      fetch(`/api/users?search=${encodeURIComponent(customerQuery)}&take=8`, { headers: auth })
        .then((r) => r.json())
        .then((d) => setCustomerHits(d.users || []))
        .catch(() => setCustomerHits([]))
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerQuery, customerOpen])

  // Product search (debounced).
  useEffect(() => {
    if (!productOpen) return
    const t = setTimeout(() => {
      fetch(`/api/orders/admin/product-search?q=${encodeURIComponent(productQuery)}`, { headers: auth })
        .then((r) => r.json())
        .then((d) => setProductHits(d.products || []))
        .catch(() => setProductHits([]))
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery, productOpen])

  // Prices follow the selected customer: their role price (or contract / tier / base price) for each line's quantity.
  // Lines of an existing order keep their saved price, and a price the admin typed is never overwritten.
  const quoteKey = JSON.stringify([customer?.id, lines.map((l) => [l.key, l.productId, l.variantId, l.quantity, !!l.priceTouched, !!l.id])])
  useEffect(() => {
    if (!customer) return
    const todo = lines.filter((l) => !l.id && !l.priceTouched && l.productId)
    if (todo.length === 0) return
    const t = setTimeout(() => {
      fetch("/api/orders/admin/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          userId: customer.id,
          items: todo.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: Math.max(1, num(l.quantity)) })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.prices) return
          setLines((prev) => prev.map((l) => {
            if (l.id || l.priceTouched) return l
            const i = todo.findIndex((x) => x.key === l.key)
            const q = i >= 0 ? d.prices[i] : null
            return q && q.unitPrice !== null && String(q.unitPrice) !== l.unitPrice ? { ...l, unitPrice: String(q.unitPrice) } : l
          }))
        })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey])

  // New order: GST rates + default shipping come from the tax / shipping rules for this customer and state.
  const pricingKey = JSON.stringify([customer?.id, shipping.state, lines.map((l) => [l.productId, l.quantity, l.unitPrice])])
  useEffect(() => {
    if (isEdit || !customer || lines.length === 0) return
    const t = setTimeout(() => {
      fetch("/api/orders/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          userId: customer.id,
          state: shipping.state || undefined,
          items: lines.map((l) => ({ productId: l.productId, quantity: Math.max(1, num(l.quantity)), unitPrice: num(l.unitPrice) })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return
          setRates(d.rates)
          if (!shippingTouched) setShippingFee(String(d.shipping ?? 0))
        })
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey])

  // Any change to lines / discount / shipping recalculates the total again (drops a hand-typed total).
  const resetTotal = () => setTotalOverride(null)

  const totals = useMemo(() => {
    const subtotal = round2(lines.reduce((s, l) => s + num(l.quantity) * num(l.unitPrice), 0))
    const cgst = round2((subtotal * rates.cgst) / 100)
    const sgst = round2((subtotal * rates.sgst) / 100)
    const igst = round2((subtotal * rates.igst) / 100)
    const tax = cgst + sgst + igst
    const raw = round2(Math.max(0, subtotal - num(discount)) + tax + num(shippingFee))
    return { subtotal, tax, raw, total: totalOverride !== null ? num(totalOverride) : raw }
  }, [lines, rates, discount, shippingFee, totalOverride])

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
    resetTotal()
  }

  const addProduct = (p: ProductHit) => {
    const first = p.variants[0]
    setLines((prev) => [
      ...prev,
      {
        key: newKey(), productId: p.id, title: p.title, sku: p.sku,
        variantId: p.hasVariants && first ? first.id : "",
        variants: p.variants, hasVariants: p.hasVariants && p.variants.length > 0,
        quantity: "1", unitPrice: String(p.hasVariants && first ? first.price : p.unitPrice),
        available: p.hasVariants && first ? first.available : p.available,
      },
    ])
    setProductQuery("")
    setProductOpen(false)
    resetTotal()
  }

  const pickCustomer = async (c: Customer) => {
    setCustomer(c)
    setCustomerOpen(false)
    setCustomerQuery("")
    setError("")
    // Pre-fill the addresses from the customer's profile / saved address.
    let addr: any = null
    try {
      const u = await fetch(`/api/users/${c.id}`, { headers: auth }).then((r) => r.json())
      addr = (u.addresses || [])[0] || null
    } catch { /* fall back to name / email only */ }
    const base: Address = {
      ...emptyAddress,
      fullName: customerName(c), phone: c.phone || "", email: c.email,
      street: addr?.street || "", city: addr?.city || "", state: addr?.state || "", zip: addr?.zip || "", country: addr?.country || "India",
    }
    setShipping(base)
    setBilling(base)
  }

  const createClient = async () => {
    setNewClientError("")
    const { firstName, lastName, email, role } = newClient
    if (!firstName.trim() || !lastName.trim() || !email.trim()) { setNewClientError("First name, last name and email are required"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setNewClientError("Enter a valid email"); return }
    setCreatingClient(true)
    try {
      const body: Record<string, string> = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), status: "ACTIVE" }
      if (role.startsWith("enum:")) body.role = role.slice(5)
      else body.roleId = role
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(d.message) ? d.message.join(", ") : d.message
        setNewClientError(/exist/i.test(msg || "") ? "A user with this email already exists — search for them above" : msg || "Failed to create client")
        return
      }
      await pickCustomer({ id: d.id, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone })
      setShowNewClient(false)
      setNewClient({ firstName: "", lastName: "", email: "", role: "enum:BUYER" })
    } catch {
      setNewClientError("Failed to create client")
    } finally {
      setCreatingClient(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!isEdit && !customer) { setError("Select a client for this order"); return }
    if (lines.length === 0) { setError("Add at least one product"); return }
    for (const l of lines) {
      if (l.hasVariants && !l.variantId) { setError(`Choose a variant for "${l.title}"`); return }
      if (!Number.isInteger(num(l.quantity)) || num(l.quantity) < 1) { setError(`Enter a quantity of 1 or more for "${l.title}"`); return }
      if (l.available !== undefined && num(l.quantity) > Math.max(0, l.available)) { setError(l.available <= 0 ? `"${l.title}" is out of stock` : `Only ${l.available} of "${l.title}" in stock`); return }
      if (l.unitPrice === "" || num(l.unitPrice) < 0) { setError(`Enter a price for "${l.title}"`); return }
    }
    const se = validateAddress(shipping)
    const be = sameBilling ? {} : validateAddress(billing)
    setShipErrors(se); setBillErrors(be)
    if (Object.keys(se).length || Object.keys(be).length) { setError("Please fix the highlighted address fields"); return }

    const clean = (a: Address) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]).filter(([, v]) => v !== ""))
    const body: any = {
      items: lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        productId: l.productId,
        ...(l.variantId ? { variantId: l.variantId } : {}),
        quantity: num(l.quantity),
        unitPrice: round2(num(l.unitPrice)),
      })),
      shippingAddress: clean(shipping),
      billingAddress: clean(sameBilling ? shipping : billing),
      discountAmount: round2(num(discount)),
      shippingAmount: round2(num(shippingFee)),
      notes: notes.trim() || undefined,
    }
    if (!isEdit) body.userId = customer!.id
    if (totalOverride !== null) body.totalAmount = round2(num(totalOverride))

    setSaving(true)
    try {
      const res = await fetch(isEdit ? `/api/orders/${order.id}/edit` : "/api/orders/admin", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(Array.isArray(d.message) ? d.message.join(", ") : d.message || "Failed to save order")
        return
      }
      router.push(`/admin/orders/${d.order.id}`)
    } catch {
      setError("Failed to save order")
    } finally {
      setSaving(false)
    }
  }

  const customerBox = useRef<HTMLDivElement>(null)
  const productBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (customerBox.current && !customerBox.current.contains(e.target as Node)) setCustomerOpen(false)
      if (productBox.current && !productBox.current.contains(e.target as Node)) setProductOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const card = "admin-card-static p-6 space-y-4"
  const h2 = "font-semibold text-gray-900 dark:text-gray-100"

  return (
    <form onSubmit={submit} className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={isEdit ? `/admin/orders/${order.id}` : "/admin/orders"} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={18} /></Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEdit ? `Edit order #${order.orderNumber}` : "New order"}</h1>
        </div>
      </div>

      {/* Client */}
      <div className={card}>
        <h2 className={h2}>Client</h2>
        {isEdit ? (
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium">{customer ? customerName(customer) : "Guest"}</p>
            {customer?.email && <p className="text-gray-500">{customer.email}</p>}
          </div>
        ) : (
          <>
            {customer ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{customerName(customer)}</p>
                  <p className="text-gray-500">{customer.email}{customer.companyName ? ` · ${customer.companyName}` : ""}</p>
                </div>
                <button type="button" onClick={() => setCustomer(null)} className="p-1.5 text-gray-400 hover:text-red-600" title="Change client"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <div ref={customerBox} className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    placeholder="Search client by name, email, phone or company..."
                    value={customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setCustomerOpen(true) }}
                    onFocus={() => setCustomerOpen(true)}
                    className={`${inputCls} pl-9`}
                  />
                  {customerOpen && (
                    <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                      {customerHits.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No clients found</li>}
                      {customerHits.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => pickCustomer(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{customerName(c)}</span>
                            <span className="text-gray-500"> · {c.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" onClick={() => setShowNewClient((v) => !v)} className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-primary-600 text-primary-700 dark:text-primary-400 rounded-lg text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  <UserPlus size={16} /> New client
                </button>
              </div>
            )}

            {showNewClient && !customer && (
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">New client</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="First name" required><input value={newClient.firstName} onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })} className={inputCls} /></FormField>
                  <FormField label="Last name" required><input value={newClient.lastName} onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })} className={inputCls} /></FormField>
                  <FormField label="Email" required><input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className={inputCls} /></FormField>
                  <FormField label="Role">
                    <select value={newClient.role} onChange={(e) => setNewClient({ ...newClient, role: e.target.value })} className={inputCls}>
                      {BUILTIN_ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </FormField>
                </div>
                {newClientError && <p className="text-sm text-red-600">{newClientError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowNewClient(false)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                  <button type="button" onClick={createClient} disabled={creatingClient} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{creatingClient ? "Creating..." : "Create & select"}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Products */}
      <div className={card}>
        <h2 className={h2}>Products</h2>
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 dark:text-gray-400 text-xs">
                <tr><th className="pb-2 pr-3 font-medium">Product</th><th className="pb-2 pr-3 font-medium w-24">Qty</th><th className="pb-2 pr-3 font-medium w-32">Price (excl. GST)</th><th className="pb-2 pr-3 font-medium w-28 text-right">Line total</th><th className="pb-2 w-8"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lines.map((l) => (
                  <tr key={l.key} className="align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{l.title}</p>
                      {l.hasVariants ? (
                        <select
                          value={l.variantId}
                          onChange={(e) => {
                            const v = l.variants.find((x) => x.id === e.target.value)
                            updateLine(l.key, { variantId: e.target.value, ...(v ? { unitPrice: String(v.price), available: v.available } : {}) })
                          }}
                          className={`${inputCls} mt-1`}
                        >
                          {l.variants.length === 0 && <option value={l.variantId}>Current variant</option>}
                          {l.variants.map((v) => <option key={v.id} value={v.id}>{v.label} — {v.sku} ({v.available} in stock)</option>)}
                        </select>
                      ) : (
                        l.sku && <p className="text-xs text-gray-500">SKU: {l.sku}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min={1} step={1} value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} className={`${inputCls} ${l.available !== undefined && num(l.quantity) > Math.max(0, l.available) ? "!border-red-400" : ""}`} />
                      {l.available !== undefined && num(l.quantity) > Math.max(0, l.available) && <p className="text-xs text-red-500 mt-1">{l.available <= 0 ? "Out of stock" : `Only ${l.available} in stock`}</p>}
                    </td>
                    <td className="py-2 pr-3"><input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: e.target.value, priceTouched: true })} className={inputCls} /></td>
                    <td className="py-2 pr-3 text-right font-medium text-gray-900 dark:text-gray-100 pt-4">{formatPrice(round2(num(l.quantity) * num(l.unitPrice)))}</td>
                    <td className="py-2 pt-3"><button type="button" onClick={() => { setLines((p) => p.filter((x) => x.key !== l.key)); resetTotal() }} className="p-1.5 text-gray-400 hover:text-red-600" title="Remove"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div ref={productBox} className="relative">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            placeholder="Add product — type a name or SKU..."
            value={productQuery}
            onChange={(e) => { setProductQuery(e.target.value); setProductOpen(true) }}
            onFocus={() => setProductOpen(true)}
            className={`${inputCls} pl-9`}
          />
          {productOpen && (
            <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
              {productHits.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No products found</li>}
              {productHits.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{p.title}</span>
                      <span className="block text-xs text-gray-500">{p.sku ? `SKU ${p.sku} · ` : ""}{p.hasVariants ? `${p.variants.length} variants` : `${p.available} in stock`}</span>
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 shrink-0">{p.hasVariants && p.variants.length ? `from ${formatPrice(Math.min(...p.variants.map((v) => v.price)))}` : formatPrice(p.unitPrice)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={card}>
          <h2 className={h2}>Shipping address</h2>
          <AddressForm value={shipping} onChange={(a) => { setShipping(a); setShipErrors({}) }} errors={shipErrors} />
        </div>
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={h2}>Billing address</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={sameBilling} onChange={(e) => setSameBilling(e.target.checked)} className="accent-primary-600" /> Same as shipping
            </label>
          </div>
          {sameBilling ? <p className="text-sm text-gray-500">Billing address is the same as the shipping address.</p> : <AddressForm value={billing} onChange={(a) => { setBilling(a); setBillErrors({}) }} errors={billErrors} />}
        </div>
      </div>

      {/* Totals */}
      <div className={card}>
        <h2 className={h2}>Order summary</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <FormField label="Notes"><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></FormField>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Subtotal</span><span>{formatPrice(totals.subtotal)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-gray-600 dark:text-gray-400">Discount (₹)</span><input type="number" min={0} step="0.01" value={discount} onChange={(e) => { setDiscount(e.target.value); resetTotal() }} className={`${inputCls} !w-32 text-right`} /></div>
            <div className="flex items-center justify-between gap-3"><span className="text-gray-600 dark:text-gray-400">Shipping (₹)</span><input type="number" min={0} step="0.01" value={shippingFee} onChange={(e) => { setShippingFee(e.target.value); setShippingTouched(true); resetTotal() }} className={`${inputCls} !w-32 text-right`} /></div>
            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">GST / taxes{rates.cgst + rates.sgst + rates.igst > 0 ? ` (${round2(rates.cgst + rates.sgst + rates.igst)}%)` : ""}</span><span>{formatPrice(totals.tax)}</span></div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-2">
              <span className="font-bold text-gray-900 dark:text-gray-100">Total (₹)</span>
              <input
                type="number" min={0} step="0.01"
                value={totalOverride !== null ? totalOverride : String(totals.raw)}
                onChange={(e) => setTotalOverride(e.target.value)}
                className={`${inputCls} !w-36 text-right font-bold`}
              />
            </div>
            <p className="text-xs text-gray-400">The total is recalculated whenever products, quantities, prices, discount or shipping change. You can also type a final total yourself; the difference is stored as round off on the invoice.</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <Link href={isEdit ? `/admin/orders/${order.id}` : "/admin/orders"} className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</Link>
        <button type="submit" disabled={saving} className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create order"}
        </button>
      </div>
    </form>
  )
}
