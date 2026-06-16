"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { ShoppingCart, ArrowLeft, Package, Trash2 } from "lucide-react"
import CartItemCard from "@/components/cart/CartItemCard"
import CartSummary from "@/components/cart/CartSummary"
import { formatPrice, getCartSessionId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import { useStorefrontRules } from "@/lib/rules"
import { useAuth } from "@/lib/auth"

interface TierPrice { minQty: number; maxQty: number | null; price: string }
interface CartItem {
  id: string; quantity: number; unitPrice: number
  product: { id: string; title: string; handle: string; sku: string | null; thumbnail: string | null; moq: number; inventoryQuantity: number; unitPrice: string; compareAtPrice: string | null; tierPrices: TierPrice[] }
}
interface Totals { subtotal: number; itemCount: number; tax: number; shipping: number; couponDiscount: number; couponApplied: string | null; total: number }
interface CartData { cart: { id: string; items: CartItem[] }; totals: Totals }

export default function CartPage() {
  const [data, setData] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const { t } = useTranslation()
  const { user } = useAuth()

  const cartItemsForRules = useMemo(
    () => (data?.cart.items ?? []).map((item) => ({ id: item.product.id, categoryId: (item.product as any).category?.id, unitPrice: Number(item.product.unitPrice) })),
    [data?.cart.items]
  )
  const { productDiscounts, cartDiscount, paymentMethodDiscount, bogo, shipping, taxes, minimumOrderQuantities, maximumOrderQuantities, checkoutRestrictions, quantityDiscounts, extraCharges, hiddenProductIds, hiddenPriceProductIds, nonPurchasableProducts } = useStorefrontRules(cartItemsForRules)

  const ruleProductDiscountMap = useMemo(() => {
    const m = new Map<string, { discountAmount: number; discountPercent: number; ruleName: string }>()
    for (const d of productDiscounts) m.set(d.productId, d)
    return m
  }, [productDiscounts])

  const bogoMap = useMemo(() => {
    const m = new Map<string, { buyQuantity: number; freeProductId: string; freeQuantity: number; ruleName: string }[]>()
    for (const b of bogo) { const arr = m.get(b.buyProductId) || []; arr.push(b); m.set(b.buyProductId, arr) }
    return m
  }, [bogo])

  const qtyDiscountMap = useMemo(() => {
    const m = new Map<string, { tiers: { minQty: number; discountType: string; discountValue: number }[]; ruleName: string }>()
    for (const qd of quantityDiscounts) { if (qd.productId) m.set(qd.productId, qd) }
    return m
  }, [quantityDiscounts])

  const fetchCart = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("/api/cart", { cache: "no-store", headers })
      if (res.ok) { const json = await res.json(); setData(json) }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCart() }, [fetchCart])

  const handleUpdate = async (itemId: string, quantity: number) => {
    setUpdating(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("/api/cart", { method: "PUT", headers, body: JSON.stringify({ itemId, quantity }) })
      if (res.ok) { const json = await res.json(); setData(json); recalcCoupon(json.totals.subtotal) }
    } catch (err) { console.error(err) } finally { setUpdating(false) }
  }

  const handleRemove = async (itemId: string) => {
    setUpdating(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("/api/cart", { method: "DELETE", headers, body: JSON.stringify({ itemId }) })
      if (res.ok) { const json = await res.json(); setData(json); recalcCoupon(json.totals.subtotal) }
    } catch (err) { console.error(err) } finally { setUpdating(false) }
  }

  const recalcCoupon = (subtotal: number) => {
    if (couponCode && data) {
      fetch("/api/cart/coupon", { method: "POST", headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() }, body: JSON.stringify({ code: couponCode }) })
        .then((res) => res.json())
        .then((result) => { if (result.valid) { setCouponDiscount(result.discountAmount) } else { setCouponCode(null); setCouponDiscount(0); setCouponError(result.message) } })
    }
  }

  const handleApplyCoupon = async (code: string) => {
    setCouponLoading(true); setCouponError("")
    try {
      const res = await fetch("/api/cart/coupon", { method: "POST", headers: { "Content-Type": "application/json", "x-session-id": getCartSessionId() }, body: JSON.stringify({ code }) })
      const result = await res.json()
      if (result.valid) { setCouponCode(code.toUpperCase()); setCouponDiscount(result.discountAmount) } else { setCouponError(result.message) }
    } catch (err) { setCouponError("Failed to apply coupon") } finally { setCouponLoading(false) }
  }

  const handleRemoveCoupon = () => { setCouponCode(null); setCouponDiscount(0); setCouponError("") }

  const totals = data?.totals ?? { subtotal: 0, itemCount: 0, tax: 0, shipping: 0, total: 0 }

  const ruleProductSavings = (data?.cart.items ?? []).reduce((sum, item) => {
    const disc = ruleProductDiscountMap.get(item.product.id); if (!disc) return sum
    return sum + disc.discountAmount * item.quantity
  }, 0)
  const ruleCartSavings = cartDiscount?.discountAmount ?? 0
  const paymentSavings = paymentMethodDiscount?.discountAmount ?? 0
  const qtyDiscountSavings = (data?.cart.items ?? []).reduce((sum, item) => {
    const qd = qtyDiscountMap.get(item.product.id); if (!qd) return sum
    const applicableTier = [...qd.tiers].sort((a, b) => b.minQty - a.minQty).find(t => item.quantity >= t.minQty)
    if (!applicableTier) return sum
    if (applicableTier.discountType === "PERCENTAGE") return sum + (Number(item.unitPrice) * item.quantity * applicableTier.discountValue) / 100
    return sum + applicableTier.discountValue * item.quantity
  }, 0)
  const extraChargesTotal = extraCharges.reduce((sum, ec) => sum + ec.chargeAmount, 0)
  const ruleTaxTotal = taxes.reduce((sum, tax) => sum + (totals.subtotal * tax.taxRate) / 100, 0)
  const effectiveShipping = shipping ? shipping.cost : totals.shipping
  const adjustedTotal = Math.max(0, totals.subtotal - ruleProductSavings - ruleCartSavings - paymentSavings - qtyDiscountSavings - couponDiscount + extraChargesTotal + ruleTaxTotal + effectiveShipping)
  const totalSavings = (data?.cart.items ?? []).reduce((sum, item) => {
    const listPrice = Number(item.product.unitPrice); const effectivePrice = Number(item.unitPrice)
    const ruleDisc = ruleProductDiscountMap.get(item.product.id); const ruleDiscountPerUnit = ruleDisc ? ruleDisc.discountAmount : 0
    return sum + ((listPrice - effectivePrice) + ruleDiscountPerUnit) * item.quantity
  }, 0) + ruleCartSavings + paymentSavings + qtyDiscountSavings

  const packageSavings = (() => {
    const seen = new Set<string>(); let savings = 0
    for (const item of data?.cart.items ?? []) {
      const meta = (item as any).metadata
      if (meta?.packageId && !seen.has(meta.packageId)) {
        seen.add(meta.packageId)
        for (const d of meta.groupDiscounts || []) savings += Number(d.discountAmount || 0)
      }
    }
    return savings
  })()

  const discountBreakdown = (data?.cart.items ?? []).reduce((acc, item) => {
    const meta = (item as any).metadata?.pricing; if (!meta) return acc
    if (meta.contractPrice && meta.contractPrice < meta.basePrice) acc.contract = (acc.contract || 0) + (meta.basePrice - meta.contractPrice) * item.quantity
    if (meta.seasonalDiscount > 0) { acc.seasonal = (acc.seasonal || 0) + meta.seasonalDiscount * item.quantity; if (meta.appliedDiscounts?.length) meta.appliedDiscounts.forEach((d: string) => { if (!acc.labels.includes(d)) acc.labels.push(d) }) }
    if (meta.rolePrice && meta.rolePrice < meta.basePrice) { acc.roleSavings = (acc.roleSavings || 0) + (meta.basePrice - meta.rolePrice) * item.quantity; if (meta.appliedRoleName && !acc.roleName) acc.roleName = meta.appliedRoleName }
    if (meta.tierPrice && meta.tierPrice < meta.basePrice) {
      const bestOtherPrice = Math.min(meta.rolePrice ?? meta.basePrice, meta.contractPrice ?? meta.basePrice)
      if (meta.tierPrice <= bestOtherPrice) acc.tierSavings = (acc.tierSavings || 0) + (meta.basePrice - meta.tierPrice) * item.quantity
    }
    return acc
  }, { contract: 0, seasonal: 0, roleSavings: 0, tierSavings: 0, roleName: undefined as string | undefined, labels: [] as string[] } as { contract: number; seasonal: number; roleSavings: number; tierSavings: number; roleName: string | undefined; labels: string[] })

  const ruleDiscountLabels: string[] = []
  for (const d of productDiscounts) { if (d.ruleName && !ruleDiscountLabels.includes(d.ruleName)) ruleDiscountLabels.push(d.ruleName) }
  if (cartDiscount?.ruleName && !ruleDiscountLabels.includes(cartDiscount.ruleName)) ruleDiscountLabels.push(cartDiscount.ruleName)
  const bogoFreeItems = bogo.map(b => ({ freeProductId: b.freeProductId, freeQuantity: b.freeQuantity, ruleName: b.ruleName }))

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50/50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>

  if (!data || data.cart.items.length === 0) return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center py-20">
      <div className="card-base p-10 text-center max-w-md">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShoppingCart size={36} className="text-gray-300" />
        </div>
        <h1 className="heading-lg mb-2">{t("cart.empty")}</h1>
        <p className="body-sm mb-6">Start adding products to see your wholesale savings here.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/products" className="btn-primary flex items-center justify-center gap-2"><Package size={18} /> Browse Products</Link>
          <Link href="/" className="btn-outline flex items-center justify-center gap-2"><ArrowLeft size={18} /> Back to Home</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="heading-lg">{t("cart.title")}</h1>
            <p className="body-sm mt-1">{totals.itemCount} item{totals.itemCount !== 1 ? "s" : ""} in your cart</p>
          </div>
          {totalSavings > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-xl">
              <span className="text-sm text-green-700 font-medium">Total savings:</span>
              <span className="text-sm font-bold text-green-700">{formatPrice(totalSavings)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {(() => {
              const packageGroups = new Map<string, any[]>()
              const standaloneItems: any[] = []

              for (const item of data.cart.items) {
                const meta = (item as any).metadata
                const packageId = meta?.packageId
                if (packageId) {
                  if (!packageGroups.has(packageId)) packageGroups.set(packageId, [])
                  packageGroups.get(packageId)!.push(item)
                } else {
                  standaloneItems.push(item)
                }
              }

              return (
                <>
                  {Array.from(packageGroups.entries()).map(([packageId, items]) => {
                    const firstMeta = (items[0] as any).metadata
                    const packageTotal = firstMeta?.packageTotal ?? items.reduce((sum: number, i: any) => sum + Number(i.unitPrice) * i.quantity, 0)
                    const packageTitle = firstMeta?.packageTitle || "Custom Package"
                    const selectedComponents = firstMeta?.selectedComponents || []
                    const groupDiscounts = firstMeta?.groupDiscounts || []

                    return (
                      <div key={packageId} className="card-base overflow-hidden">
                        <div className="bg-primary-50 px-5 py-3.5 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{packageTitle}</h3>
                            <span className="text-xs text-primary-600">Configured Package</span>
                          </div>
                          <button onClick={() => items.forEach((i: any) => handleRemove(i.id))} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove package">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {selectedComponents.map((comp: any) => (
                            <div key={comp.productId} className="px-5 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{comp.groupName}</span>
                                <span className="text-sm font-medium text-gray-900">{comp.productTitle}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm text-gray-900">{formatPrice(comp.unitPrice)}</span>
                                {comp.groupDiscount > 0 && <span className="ml-2 text-xs text-green-600">-{formatPrice(comp.groupDiscount)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {groupDiscounts.length > 0 && (
                          <div className="px-5 py-2.5 bg-green-50">
                            {groupDiscounts.map((d: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs text-green-700">
                                <span>{d.groupName} discount ({d.discountType === "PERCENTAGE" ? `${d.discountValue}%` : formatPrice(d.discountValue)})</span>
                                <span>-{formatPrice(d.discountAmount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="px-5 py-3.5 bg-gray-50 flex justify-between items-center border-t border-gray-100">
                          <span className="font-bold text-gray-900">Package Total</span>
                          <span className="text-lg font-bold text-primary-600">{formatPrice(packageTotal)}</span>
                        </div>
                      </div>
                    )
                  })}

                  {standaloneItems.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdate}
                      onRemove={handleRemove}
                      updating={updating}
                      ruleProductDiscount={ruleProductDiscountMap.get(item.product.id) ?? null}
                      bogoOffers={bogoMap.get(item.product.id) || []}
                      quantityDiscount={qtyDiscountMap.get(item.product.id) ?? null}
                      minQtyRule={minimumOrderQuantities.find(m => m.productId === item.product.id) ?? null}
                      maxQtyRule={maximumOrderQuantities.find(m => m.productId === item.product.id) ?? null}
                    />
                  ))}
                </>
              )
            })()}

            <Link href="/products" className="inline-flex items-center gap-2 text-sm text-primary-600 font-medium hover:text-primary-700 transition-colors mt-2">
              <ArrowLeft size={16} /> Continue Shopping
            </Link>
          </div>

          <div className="lg:col-span-1">
            <CartSummary
              subtotal={totals.subtotal} itemCount={totals.itemCount}
              tax={ruleTaxTotal > 0 ? ruleTaxTotal : totals.tax}
              shipping={effectiveShipping} couponDiscount={couponDiscount}
              couponCode={couponCode} total={adjustedTotal}
              totalSavings={totalSavings} contractSavings={discountBreakdown.contract}
              seasonalSavings={discountBreakdown.seasonal} rolePriceSavings={discountBreakdown.roleSavings}
              tierSavings={discountBreakdown.tierSavings} appliedRoleName={discountBreakdown.roleName}
              ruleProductSavings={ruleProductSavings} ruleCartSavings={ruleCartSavings}
              ruleDiscountLabels={ruleDiscountLabels} paymentMethodDiscount={paymentMethodDiscount}
              qtyDiscountSavings={qtyDiscountSavings} extraCharges={extraCharges}
              taxes={taxes} shippingOverride={shipping} bogoFreeItems={bogoFreeItems}
              checkoutRestrictions={checkoutRestrictions} minimumOrderQuantities={minimumOrderQuantities}
              maximumOrderQuantities={maximumOrderQuantities}
              cartItems={(data?.cart.items ?? []).map(i => ({ id: i.id, quantity: i.quantity, product: { id: i.product.id, title: i.product.title } }))}
              discountLabels={[...discountBreakdown.labels, ...ruleDiscountLabels]}
              packageSavings={packageSavings} onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon} couponLoading={couponLoading} couponError={couponError}
            />
          </div>
        </div>
      </main>
    </div>
  )
}