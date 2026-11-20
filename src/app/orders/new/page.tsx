"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Check, ChevronRight, Gift, Info, Loader2, Minus, Package, Plus, Search, Sparkles, Tag, Trash2, X,
} from "lucide-react"
import { formatPrice, getCartSessionId, isExternalImageUrl } from "@/lib/utils"
import { chooseOffer } from "@/lib/offerChoices"
import { useAuth } from "@/lib/auth"

// ── Types (only the fields this page reads) ──
interface TierPrice { minQty: number; maxQty: number | null; price: string | number }
interface Pricing {
  basePrice: number; finalPrice: number; appliedRule: "contract" | "role" | "tier" | "discount" | "base"
  appliedRoleName: string | null; roleTiers?: { minQty: number; price: number }[]
}
interface CartItem {
  id: string; productId: string; quantity: number; unitPrice: string | number; variantId: string | null
  variantLabel?: string
  metadata: { bogo?: boolean; buyProductId?: string; offerChoice?: string; pricing?: Pricing } | null
  product: {
    id: string; title: string; handle: string; sku: string | null; thumbnail: string | null; moq: number
    inventoryQuantity: number; unitPrice: string | number; compareAtPrice: string | number | null; categoryId: string | null
    hasVariants: boolean; tierPrices: TierPrice[]
  }
  variant?: { id: string; sku: string; price: string | number; image: string | null; inventoryQuantity: number; reservedQuantity: number } | null
}
interface LineAdj { itemId: string; productId: string; offerDiscount: number; offerRuleName: string | null; qtyDiscount: number; qtyRuleName: string | null }
interface Summary {
  lines: LineAdj[]; subtotal: number; productSavings: number; qtySavings: number
  cartDiscount: { amount: number; ruleName: string | null } | null
  paymentDiscount: { amount: number; ruleName: string | null } | null
  extraCharges: { chargeAmount: number; chargeLabel: string }[]
  discount: number; tax: number; taxRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number
  shipping: number; shippingRule: { shippingType: string; ruleName: string } | null
  roundOff: number; total: number
  minimumOrderQuantities: { productId?: string; minQty: number; ruleName: string }[]
  maximumOrderQuantities: { productId?: string; maxQty: number; ruleName: string }[]
  checkoutRestrictions: { message: string }[]
  nonPurchasable: { productId: string; message?: string }[]
  hiddenPrices: string[]
}
interface Offer {
  ruleId: string; name: string; type: string; description: string; summary: string; condition: string | null
  unitsNeeded: number; eligible: boolean; savings: number; validUntil: string | null
}
interface Hit {
  id: string; title: string; handle: string; sku: string | null; thumbnail: string | null; images?: string[]; moq: number
  inventoryQuantity: number; reservedQuantity?: number; unitPrice: string | number; hasVariants: boolean; companyName?: string | null
}
interface Variant { id: string; sku: string; options: Record<string, string>; price: string | number; inventoryQuantity: number; reservedQuantity: number; isActive: boolean }

const num = (v: unknown) => Number(v) || 0
const isFree = (i: CartItem) => i.metadata?.bogo === true

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = { "x-session-id": getCartSessionId() }
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  if (token) h.Authorization = `Bearer ${token}`
  if (json) h["Content-Type"] = "application/json"
  return h
}

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Something went wrong")
  return data
}

/** Where the buyer's unit price comes from, in their words. */
function priceSource(p: Pricing | undefined): string | null {
  if (!p) return null
  switch (p.appliedRule) {
    case "contract": return "Your contract price"
    case "role": return p.appliedRoleName ? `${p.appliedRoleName} price` : "Your role price"
    case "tier": return "Bulk tier price"
    case "discount": return "Sale price"
    default: return null
  }
}

/** The next quantity break that lowers this buyer's unit price, if any. */
function nextBreak(item: CartItem, unit: number): { minQty: number; price: number } | null {
  const p = item.metadata?.pricing
  const tiers = p?.appliedRule === "role" || (p?.roleTiers?.length ?? 0) > 0
    ? (p?.roleTiers || []).map((t) => ({ minQty: t.minQty, price: num(t.price) }))
    : item.variantId ? [] : item.product.tierPrices.map((t) => ({ minQty: t.minQty, price: num(t.price) }))
  return tiers.filter((t) => t.minQty > item.quantity && t.price < unit).sort((a, b) => a.minQty - b.minQty)[0] || null
}

export default function CreateOrderPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [items, setItems] = useState<CartItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [startedWith, setStartedWith] = useState<number | null>(null)
  const [state, setState] = useState("")

  // Search
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [hitPrices, setHitPrices] = useState<Record<string, Pricing>>({})
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [variantPick, setVariantPick] = useState<{ hit: Hit; variants: Variant[]; options: string[] } | null>(null)
  const searchBox = useRef<HTMLDivElement>(null)

  // Offers per product
  const [offers, setOffers] = useState<Record<string, { offers: Offer[]; appliedId: string | null }>>({})
  const [offerModal, setOfferModal] = useState<string | null>(null)

  // Local quantity edits (sent after a short pause)
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({})
  const qtyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!authLoading && !user) router.push("/login?redirect=/orders/new")
  }, [authLoading, user, router])

  // Default delivery state decides CGST+SGST vs IGST in the estimate.
  useEffect(() => {
    if (!user) return
    api<any>("/api/addresses", { headers: headers() })
      .then((d) => {
        const list = Array.isArray(d) ? d : d.addresses || []
        const a = list.find((x: any) => x.isDefault) || list[0]
        if (a?.state) setState(a.state)
      })
      .catch(() => {})
  }, [user])

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams()
    if (state) qs.set("state", state)
    const d = await api<{ cart: { items: CartItem[] }; summary: Summary }>(`/api/cart/summary?${qs}`, { headers: headers() })
    setItems(d.cart.items)
    setSummary(d.summary)
    setStartedWith((s) => (s === null ? d.cart.items.filter((i) => !isFree(i)).length : s))
    window.dispatchEvent(new CustomEvent("cart-updated"))
    return d.cart.items
  }, [state])

  useEffect(() => {
    if (!user) return
    refresh().catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [user, refresh])

  const paid = useMemo(() => items.filter((i) => !isFree(i)), [items])
  const adjByItem = useMemo(() => new Map((summary?.lines || []).map((l) => [l.itemId, l])), [summary])
  const qtyByProduct = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of paid) m.set(i.productId, (m.get(i.productId) || 0) + i.quantity)
    return m
  }, [paid])
  const inOrder = useMemo(() => new Set(paid.map((i) => `${i.productId}|${i.variantId || ""}`)), [paid])

  // Offers available on each product at its current quantity, and which one applies.
  const offersKey = JSON.stringify(paid.map((i) => [i.productId, qtyByProduct.get(i.productId), i.metadata?.offerChoice || ""]))
  useEffect(() => {
    const seen = new Set<string>()
    const jobs = paid.filter((i) => (seen.has(i.productId) ? false : (seen.add(i.productId), true)))
    if (jobs.length === 0) { setOffers({}); return }
    let alive = true
    Promise.all(
      jobs.map(async (i) => {
        const qs = new URLSearchParams({ productId: i.productId, quantity: String(qtyByProduct.get(i.productId) || i.quantity) })
        if (i.metadata?.offerChoice) qs.set("choice", i.metadata.offerChoice)
        const d = await api<{ offers: Offer[]; appliedId: string | null }>(`/api/rules/product-offers?${qs}`).catch(() => ({ offers: [], appliedId: null }))
        return [i.productId, d] as const
      }),
    ).then((pairs) => { if (alive) setOffers(Object.fromEntries(pairs)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offersKey])

  // ── Search (debounced), with this buyer's own price for each hit ──
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const d = await api<{ products: Hit[] }>(`/api/products?${new URLSearchParams({ ...(q ? { q } : {}), limit: "10" })}`, { headers: headers() })
        setHits(d.products || [])
        const prices = await Promise.all(
          (d.products || []).filter((h) => !h.hasVariants).map(async (h) => {
            const p = await api<Pricing>(`/api/pricing/calculate?productId=${h.id}&quantity=${Math.max(1, h.moq || 1)}`, { headers: headers() }).catch(() => null)
            return [h.id, p] as const
          }),
        )
        setHitPrices((prev) => ({ ...prev, ...Object.fromEntries(prices.filter((e): e is readonly [string, Pricing] => !!e[1])) }))
      } catch {
        setHits([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (searchBox.current && !searchBox.current.contains(e.target as Node)) { setOpen(false); setVariantPick(null) } }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(""), 2500) }

  const addToOrder = async (hit: Hit, variantId?: string) => {
    setError("")
    setAdding(variantId || hit.id)
    try {
      await api("/api/cart", {
        method: "POST", headers: headers(true),
        body: JSON.stringify({ productId: hit.id, quantity: Math.max(1, hit.moq || 1), ...(variantId ? { variantId } : {}) }),
      })
      await refresh()
      setVariantPick(null)
      flash(`Added ${hit.title}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAdding(null)
    }
  }

  const pickHit = async (hit: Hit) => {
    if (!hit.hasVariants) {
      if (inOrder.has(`${hit.id}|`)) { flash(`${hit.title} is already in your order — change its quantity below`); return }
      return addToOrder(hit)
    }
    try {
      const d = await api<{ product: { variants: Variant[]; variantOptions?: { name: string }[] } }>(`/api/products/${hit.handle}`, { headers: headers() })
      setVariantPick({ hit, variants: (d.product.variants || []).filter((v) => v.isActive), options: (d.product.variantOptions || []).map((o) => o.name) })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const setQty = (item: CartItem, raw: string) => {
    setQtyDraft((d) => ({ ...d, [item.id]: raw }))
    clearTimeout(qtyTimers.current[item.id])
    qtyTimers.current[item.id] = setTimeout(() => commitQty(item, raw), 600)
  }

  const commitQty = async (item: CartItem, raw: string) => {
    clearTimeout(qtyTimers.current[item.id])
    const n = Math.floor(Number(raw))
    const min = Math.max(1, item.product.moq || 1)
    if (!Number.isFinite(n) || n < min) {
      setError(`Minimum order quantity for ${item.product.title} is ${min}`)
      setQtyDraft((d) => { const { [item.id]: _, ...rest } = d; return rest })
      return
    }
    if (n === item.quantity) { setQtyDraft((d) => { const { [item.id]: _, ...rest } = d; return rest }); return }
    setError("")
    setBusy(true)
    try {
      await api("/api/cart", { method: "PUT", headers: headers(true), body: JSON.stringify({ itemId: item.id, quantity: n }) })
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setQtyDraft((d) => { const { [item.id]: _, ...rest } = d; return rest })
      setBusy(false)
    }
  }

  const removeItem = async (item: CartItem) => {
    setBusy(true)
    setError("")
    try {
      await api("/api/cart", { method: "DELETE", headers: headers(true), body: JSON.stringify({ itemId: item.id }) })
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const clearAll = async () => {
    setBusy(true)
    setError("")
    try {
      for (const i of paid) await api("/api/cart", { method: "DELETE", headers: headers(true), body: JSON.stringify({ itemId: i.id }) })
      await refresh()
      setStartedWith(0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const pickOffer = async (productId: string, choice: string | null, bumpTo?: number) => {
    setBusy(true)
    setError("")
    try {
      if (bumpTo) {
        // An offer that needs more units: raise the (first) line of this product to reach it.
        const line = paid.find((i) => i.productId === productId)
        const others = (qtyByProduct.get(productId) || 0) - (line?.quantity || 0)
        if (line) await api("/api/cart", { method: "PUT", headers: headers(true), body: JSON.stringify({ itemId: line.id, quantity: Math.max(line.quantity, bumpTo - others) }) })
      }
      await chooseOffer(productId, choice)
      await refresh()
      setOfferModal(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // ── Problems that would stop checkout ──
  const problems = useMemo(() => {
    if (!summary) return [] as string[]
    const title = (pid?: string) => paid.find((i) => i.productId === pid)?.product.title || "a product"
    const out: string[] = []
    for (const m of summary.minimumOrderQuantities) out.push(`${title(m.productId)}: order at least ${m.minQty} units (${m.ruleName})`)
    for (const m of summary.maximumOrderQuantities) {
      if (!m.productId || (qtyByProduct.get(m.productId) || 0) > m.maxQty) out.push(`${title(m.productId)}: at most ${m.maxQty} units per order (${m.ruleName})`)
    }
    for (const n of summary.nonPurchasable) out.push(`${title(n.productId)}: ${n.message || "cannot be ordered online"}`)
    for (const r of summary.checkoutRestrictions) out.push(r.message)
    return out
  }, [summary, paid, qtyByProduct])

  if (authLoading || (loading && user)) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
  }
  if (!user) return null

  const hidden = new Set(summary?.hiddenPrices || [])
  const offerSavings = (summary?.productSavings || 0) + (summary?.qtySavings || 0)
  const modalProduct = offerModal ? paid.find((i) => i.productId === offerModal) : null
  const modalOffers = offerModal ? offers[offerModal] : null
  const modalChoice = modalProduct?.metadata?.offerChoice || ""

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <main className="section-container py-8 lg:py-10">
        <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary-600 mb-4">
          <ArrowLeft size={16} /> My Orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-[28px] lg:text-[34px] font-extrabold text-gray-900 tracking-tight leading-none">Create order</h1>
            <p className="text-sm text-gray-500 mt-2">Search products, set quantities and pick offers. Prices shown are your own prices (excl. GST).</p>
          </div>
          {paid.length > 0 && (
            <button onClick={clearAll} disabled={busy} className="self-start sm:self-auto inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50">
              <Trash2 size={15} /> Clear all
            </button>
          )}
        </div>

        {startedWith !== null && startedWith > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>The {startedWith} item{startedWith === 1 ? "" : "s"} already in your cart {startedWith === 1 ? "is" : "are"} included in this order. Remove {startedWith === 1 ? "it" : "any you don't want"} below, or use Clear all to start fresh.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            {/* Search */}
            <div ref={searchBox} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); setVariantPick(null) }}
                onFocus={() => setOpen(true)}
                placeholder="Search products by name, brand or SKU to add them…"
                className="w-full h-12 rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Search products"
              />
              {open && (
                <div className="absolute z-30 mt-2 w-full max-h-[26rem] overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                  {variantPick ? (
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">Choose an option — {variantPick.hit.title}</p>
                        <button onClick={() => setVariantPick(null)} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Back to results"><X size={16} /></button>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {variantPick.variants.map((v) => {
                          const stock = v.inventoryQuantity - v.reservedQuantity
                          const label = (variantPick.options.length ? variantPick.options.map((o) => v.options[o]).filter(Boolean) : Object.values(v.options)).join(" / ")
                          const added = inOrder.has(`${variantPick.hit.id}|${v.id}`)
                          return (
                            <li key={v.id}>
                              <button
                                disabled={stock <= 0 || added || adding === v.id}
                                onClick={() => addToOrder(variantPick.hit, v.id)}
                                className="w-full flex items-center justify-between gap-3 px-2 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
                              >
                                <span className="min-w-0"><span className="font-medium text-gray-900">{label}</span><span className="block text-xs text-gray-500">{v.sku} · {stock > 0 ? `${stock} in stock` : "Out of stock"}</span></span>
                                <span className="shrink-0 font-semibold text-gray-900">{added ? <span className="text-green-600 inline-flex items-center gap-1"><Check size={14} /> Added</span> : formatPrice(num(v.price))}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : (
                    <>
                      {searching && hits.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>}
                      {!searching && hits.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No products found</p>}
                      <ul className="divide-y divide-gray-100">
                        {hits.map((h) => {
                          const stock = h.inventoryQuantity - (h.reservedQuantity || 0)
                          const p = hitPrices[h.id]
                          const added = !h.hasVariants && inOrder.has(`${h.id}|`)
                          const thumb = h.thumbnail || h.images?.[0]
                          return (
                            <li key={h.id}>
                              <button
                                onClick={() => pickHit(h)}
                                disabled={(!h.hasVariants && stock <= 0) || adding === h.id}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
                              >
                                <span className="relative h-11 w-11 shrink-0 rounded-lg border border-gray-100 bg-white overflow-hidden">
                                  {thumb ? <Image src={thumb} alt="" fill sizes="44px" unoptimized={isExternalImageUrl(thumb)} className="object-contain p-0.5" /> : <Package className="m-auto h-full text-gray-300" size={18} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold text-gray-900 truncate">{h.title}</span>
                                  <span className="block text-xs text-gray-500 truncate">
                                    {[h.sku, `MOQ ${h.moq}`, h.hasVariants ? "Choose options" : stock > 0 ? `${stock} in stock` : "Out of stock"].filter(Boolean).join(" · ")}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  {added ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600"><Check size={14} /> In order</span>
                                  ) : adding === h.id ? (
                                    <Loader2 size={16} className="animate-spin text-primary-600" />
                                  ) : (
                                    <>
                                      <span className="block text-sm font-bold text-gray-900">{p ? formatPrice(p.finalPrice) : h.hasVariants ? "" : formatPrice(num(h.unitPrice))}</span>
                                      {p && p.finalPrice < num(h.unitPrice) && <span className="block text-[11px] text-green-600">{priceSource(p) || "Your price"}</span>}
                                      {!p && h.hasVariants && <span className="inline-flex items-center text-xs font-semibold text-primary-600">Options <ChevronRight size={14} /></span>}
                                    </>
                                  )}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>

            {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
            {error && (
              <p className="flex items-start justify-between gap-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={14} /></button>
              </p>
            )}

            {/* Lines */}
            {paid.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-14 text-center">
                <Search className="mx-auto text-gray-300" size={32} />
                <p className="mt-3 font-semibold text-gray-900">Your order is empty</p>
                <p className="mt-1 text-sm text-gray-500">Search above and click a product to add it. You can add as many as you like.</p>
              </div>
            ) : (
              <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm transition-opacity ${busy ? "opacity-60" : ""}`}>
                <div className="hidden md:grid grid-cols-[minmax(0,1fr)_128px_150px_170px_110px_32px] gap-3 px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <span>Product</span><span>Quantity</span><span>Your price / unit</span><span>Offer</span><span className="text-right">Line total</span><span />
                </div>
                <ul className="divide-y divide-gray-100">
                  {paid.map((item) => {
                    const unit = num(item.unitPrice)
                    const list = item.variant ? num(item.variant.price) : num(item.product.unitPrice)
                    const adj = adjByItem.get(item.id)
                    const discount = (adj?.offerDiscount || 0) + (adj?.qtyDiscount || 0)
                    const gross = unit * item.quantity
                    const src = priceSource(item.metadata?.pricing)
                    const brk = nextBreak(item, unit)
                    const productOffers = offers[item.productId]
                    const applied = productOffers?.offers.find((o) => o.ruleId === productOffers.appliedId)
                    const freeLines = items.filter((f) => isFree(f) && f.metadata?.buyProductId === item.productId)
                    const priceHidden = hidden.has(item.productId)
                    const draft = qtyDraft[item.id]
                    const thumb = item.variant?.image || item.product.thumbnail
                    return (
                      <li key={item.id} className="px-4 py-4">
                        <div className="grid grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_128px_150px_170px_110px_32px] gap-x-3 gap-y-3 md:items-start">
                          {/* Product */}
                          <div className="col-span-2 md:col-span-1 flex gap-3 min-w-0">
                            <Link href={`/products/${item.product.handle}`} className="relative h-14 w-14 shrink-0 rounded-lg border border-gray-100 bg-white overflow-hidden">
                              {thumb ? <Image src={thumb} alt="" fill sizes="56px" unoptimized={isExternalImageUrl(thumb)} className="object-contain p-1" /> : <Package className="m-auto h-full text-gray-300" size={20} />}
                            </Link>
                            <div className="min-w-0">
                              <Link href={`/products/${item.product.handle}`} className="text-sm font-semibold text-gray-900 hover:text-primary-600 line-clamp-2">{item.product.title}</Link>
                              <p className="text-xs text-gray-500 truncate">{[item.variant?.sku || item.product.sku, `MOQ ${item.product.moq}`].filter(Boolean).join(" · ")}</p>
                            </div>
                          </div>

                          {/* Quantity */}
                          <div className="col-start-2 md:col-start-auto">
                            <span className="md:hidden text-[11px] font-semibold text-gray-400 block mb-1">Quantity</span>
                            <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden">
                              <button onClick={() => commitQty(item, String(item.quantity - 1))} disabled={busy || item.quantity <= Math.max(1, item.product.moq)} className="h-9 w-8 grid place-items-center text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Decrease quantity"><Minus size={14} /></button>
                              <input
                                type="number" min={item.product.moq} value={draft ?? String(item.quantity)}
                                onChange={(e) => setQty(item, e.target.value)}
                                onBlur={(e) => draft !== undefined && commitQty(item, e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") commitQty(item, (e.target as HTMLInputElement).value) }}
                                className="h-9 w-14 border-x border-gray-200 text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                aria-label={`Quantity of ${item.product.title}`}
                              />
                              <button onClick={() => commitQty(item, String(item.quantity + 1))} disabled={busy} className="h-9 w-8 grid place-items-center text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Increase quantity"><Plus size={14} /></button>
                            </div>
                          </div>

                          {/* Your price */}
                          <div className="col-start-2 md:col-start-auto text-sm">
                            <span className="md:hidden text-[11px] font-semibold text-gray-400 block mb-1">Your price / unit</span>
                            {priceHidden ? (
                              <span className="text-gray-500">Price on request</span>
                            ) : (
                              <>
                                <span className="font-bold text-gray-900">{formatPrice(unit)}</span>
                                {list > unit && <span className="ml-1.5 text-xs text-gray-400 line-through">{formatPrice(list)}</span>}
                                {src && <span className="block text-[11px] font-semibold text-green-600">{src}</span>}
                                {brk && <span className="block text-[11px] text-gray-500">{brk.minQty}+ units: {formatPrice(brk.price)}</span>}
                              </>
                            )}
                          </div>

                          {/* Offer */}
                          <div className="col-start-2 md:col-start-auto text-sm min-w-0">
                            <span className="md:hidden text-[11px] font-semibold text-gray-400 block mb-1">Offer</span>
                            {!productOffers ? (
                              <span className="text-xs text-gray-400">…</span>
                            ) : productOffers.offers.length === 0 ? (
                              <span className="text-xs text-gray-400">No offers</span>
                            ) : (
                              <div className="space-y-1">
                                {applied ? (
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-green-50 border border-green-100 px-2 py-0.5 text-xs font-semibold text-green-700" title={applied.summary}>
                                    <Tag size={11} className="shrink-0" /><span className="truncate">{applied.name}</span>
                                  </span>
                                ) : (
                                  <span className="block text-xs text-gray-500">{item.metadata?.offerChoice === "none" ? "No offer applied" : "Not applied yet"}</span>
                                )}
                                <button onClick={() => setOfferModal(item.productId)} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700">
                                  <Sparkles size={12} /> {productOffers.offers.length === 1 ? "View offer" : `${productOffers.offers.length} offers`} · change
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Line total */}
                          <div className="col-start-2 md:col-start-auto md:text-right text-sm">
                            <span className="md:hidden text-[11px] font-semibold text-gray-400 block mb-1">Line total</span>
                            {priceHidden ? <span className="text-gray-500">—</span> : (
                              <>
                                <span className="font-bold text-gray-900">{formatPrice(gross - discount)}</span>
                                {discount > 0 && <span className="block text-xs text-gray-400 line-through">{formatPrice(gross)}</span>}
                                {discount > 0 && <span className="block text-[11px] font-semibold text-green-600">You save {formatPrice(discount)}</span>}
                              </>
                            )}
                          </div>

                          <div className="col-start-2 md:col-start-auto">
                            <button onClick={() => removeItem(item)} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-40" aria-label={`Remove ${item.product.title}`}><Trash2 size={16} /></button>
                          </div>
                        </div>

                        {freeLines.map((f) => (
                          <div key={f.id} className="mt-3 md:ml-[68px] flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-800">
                            <Gift size={14} className="shrink-0" />
                            <span className="min-w-0 truncate"><b>FREE</b> × {f.quantity} {f.product.title}</span>
                          </div>
                        ))}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Summary */}
          <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-24 space-y-3">
            <h2 className="font-bold text-gray-900">Order summary</h2>
            {summary && paid.length > 0 ? (
              <>
                <Row label={`Subtotal (${paid.reduce((s, i) => s + i.quantity, 0)} units)`} value={formatPrice(summary.subtotal)} />
                {offerSavings > 0 && <Row label="Offer discounts" value={`-${formatPrice(offerSavings)}`} green />}
                {summary.cartDiscount && <Row label={summary.cartDiscount.ruleName || "Order discount"} value={`-${formatPrice(summary.cartDiscount.amount)}`} green />}
                <Row label={`GST${summary.taxRate ? ` (${summary.taxRate}%)` : ""}${summary.igstAmount > 0 ? " · IGST" : summary.tax > 0 ? " · CGST + SGST" : ""}`} value={formatPrice(summary.tax)} />
                <Row label="Shipping" value={summary.shipping > 0 ? formatPrice(summary.shipping) : "Free"} green={summary.shipping === 0} />
                {summary.extraCharges.map((c, i) => <Row key={i} label={c.chargeLabel} value={formatPrice(c.chargeAmount)} />)}
                {Math.abs(summary.roundOff) >= 0.01 && <Row label="Round off" value={`${summary.roundOff > 0 ? "+" : "-"}${formatPrice(Math.abs(summary.roundOff))}`} />}
                <div className="border-t border-gray-100 pt-3 flex items-baseline justify-between">
                  <span className="font-bold text-gray-900">Estimated total</span>
                  <span className="text-xl font-extrabold text-gray-900">{formatPrice(summary.total)}</span>
                </div>
                {offerSavings + (summary.cartDiscount?.amount || 0) > 0 && (
                  <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2">You save {formatPrice(offerSavings + (summary.cartDiscount?.amount || 0))} with offers on this order.</p>
                )}
                <p className="text-xs text-gray-500">
                  {state ? `GST worked out for delivery to ${state}. ` : ""}Delivery address, payment method, coupons and payment-method offers are chosen on the next step.
                </p>
                {problems.length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                    {problems.map((p, i) => <li key={i}>• {p}</li>)}
                  </ul>
                )}
                <button
                  onClick={() => router.push("/checkout")}
                  disabled={busy || problems.length > 0}
                  className="w-full h-11 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                >
                  Continue to checkout <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">Add products to see your prices, offers and total.</p>
            )}
          </aside>
        </div>
      </main>

      {/* Offers popup */}
      {offerModal && modalProduct && modalOffers && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setOfferModal(null)} role="dialog" aria-modal="true" aria-label="Offers">
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900">Offers</h3>
                <p className="text-xs text-gray-500 truncate">{modalProduct.product.title} · {qtyByProduct.get(modalProduct.productId)} units</p>
              </div>
              <button onClick={() => setOfferModal(null)} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500 px-1">One offer applies per product. Pick the one you want.</p>
              <OfferOption
                selected={!modalChoice}
                title="Best available offer"
                text="Automatically uses whichever offer saves you the most at your quantity."
                onSelect={() => pickOffer(modalProduct.productId, null)}
                disabled={busy}
              />
              {modalOffers.offers.map((o) => {
                const qty = qtyByProduct.get(modalProduct.productId) || 0
                return (
                  <OfferOption
                    key={o.ruleId}
                    selected={modalChoice === o.ruleId}
                    applied={modalOffers.appliedId === o.ruleId}
                    title={o.name}
                    text={o.summary}
                    sub={[o.condition, o.validUntil ? `Valid till ${new Date(o.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : null].filter(Boolean).join(" · ")}
                    warn={!o.eligible && o.unitsNeeded > 0 ? `Add ${o.unitsNeeded} more unit${o.unitsNeeded === 1 ? "" : "s"} to use this — selecting it raises your quantity to ${qty + o.unitsNeeded}.` : !o.eligible ? "Not available for this order" : null}
                    savings={o.eligible && o.savings > 0 ? o.savings : 0}
                    onSelect={() => pickOffer(modalProduct.productId, o.ruleId, !o.eligible && o.unitsNeeded > 0 ? qty + o.unitsNeeded : undefined)}
                    disabled={busy || (!o.eligible && o.unitsNeeded <= 0)}
                  />
                )
              })}
              <OfferOption
                selected={modalChoice === "none"}
                title="Don't apply an offer"
                text="Buy at your normal price."
                onSelect={() => pickOffer(modalProduct.productId, "none")}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold whitespace-nowrap ${green ? "text-green-600" : "text-gray-900"}`}>{value}</span>
    </div>
  )
}

function OfferOption({ selected, applied, title, text, sub, warn, savings, onSelect, disabled }: {
  selected: boolean; applied?: boolean; title: string; text: string; sub?: string; warn?: string | null; savings?: number
  onSelect: () => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${selected ? "border-primary-500 bg-primary-50/60 ring-1 ring-primary-500" : "border-gray-200 hover:border-primary-300"}`}
    >
      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 grid place-items-center ${selected ? "border-primary-600" : "border-gray-300"}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-primary-600" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {applied && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700">Applied</span>}
        </span>
        <span className="block text-xs text-gray-600 mt-0.5">{text}</span>
        {sub && <span className="block text-[11px] text-gray-400 mt-0.5">{sub}</span>}
        {warn && <span className="block text-[11px] text-amber-700 mt-1">{warn}</span>}
      </span>
      {savings ? <span className="shrink-0 text-xs font-bold text-green-600">Save {formatPrice(savings)}</span> : null}
    </button>
  )
}
