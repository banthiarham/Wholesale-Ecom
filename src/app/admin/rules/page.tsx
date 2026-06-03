"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, Edit2, Shield, ToggleLeft, ToggleRight } from "lucide-react"

interface DynamicRule {
  id: string
  name: string
  type: string
  description: string | null
  priority: number
  isActive: boolean
  conditions: Record<string, any>
  actions: Record<string, any>
  startDate: string | null
  endDate: string | null
  createdAt: string
}

interface Product { id: string; title: string }
interface Category { id: string; name: string }

const RULE_TYPES = [
  { value: "PRODUCT_DISCOUNT", label: "Product Discount" },
  { value: "CART_DISCOUNT", label: "Cart Discount" },
  { value: "PAYMENT_METHOD_DISCOUNT", label: "Payment Method Discount" },
  { value: "REQUIRED_QTY_FOR_PAYMENT_METHOD", label: "Required Qty for Payment Method" },
  { value: "BOGO", label: "BOGO (Buy X Get One Free)" },
  { value: "SHIPPING_RULE", label: "Shipping Rule" },
  { value: "MINIMUM_ORDER_QUANTITY", label: "Minimum Order Quantity" },
  { value: "TAX_RULE", label: "Tax Rule" },
  { value: "CHECKOUT_RESTRICTION", label: "Checkout Restriction" },
  { value: "QUANTITY_BASED_DISCOUNT", label: "Quantity Based Discount" },
  { value: "EXTRA_CHARGE", label: "Extra Charge" },
  { value: "BUY_X_AND_Y_FREE", label: "Buy X and Y Free" },
  { value: "MAXIMUM_ORDER_QUANTITY", label: "Maximum Order Quantity" },
  { value: "RESTRICT_PRODUCT_VISIBILITY", label: "Restrict Product Visibility" },
  { value: "HIDDEN_PRICE", label: "Hidden Price" },
  { value: "NON_PURCHASABLE", label: "Non-Purchasable" },
  { value: "LOYALTY_ORDER_EARN", label: "Loyalty: Points per Order" },
  { value: "LOYALTY_CATEGORY_BONUS", label: "Loyalty: Category Bonus" },
  { value: "LOYALTY_FIRST_ORDER_BONUS", label: "Loyalty: First Order Bonus" },
  { value: "LOYALTY_REVIEW_BONUS", label: "Loyalty: Review Bonus" },
  { value: "LOYALTY_REFERRAL_BONUS", label: "Loyalty: Referral Bonus" },
] as const

const TYPE_COLORS: Record<string, string> = {
  PRODUCT_DISCOUNT: "bg-blue-50 text-blue-700",
  CART_DISCOUNT: "bg-indigo-50 text-indigo-700",
  PAYMENT_METHOD_DISCOUNT: "bg-purple-50 text-purple-700",
  REQUIRED_QTY_FOR_PAYMENT_METHOD: "bg-violet-50 text-violet-700",
  BOGO: "bg-pink-50 text-pink-700",
  SHIPPING_RULE: "bg-orange-50 text-orange-700",
  MINIMUM_ORDER_QUANTITY: "bg-amber-50 text-amber-700",
  TAX_RULE: "bg-red-50 text-red-700",
  CHECKOUT_RESTRICTION: "bg-rose-50 text-rose-700",
  QUANTITY_BASED_DISCOUNT: "bg-cyan-50 text-cyan-700",
  EXTRA_CHARGE: "bg-yellow-50 text-yellow-700",
  BUY_X_AND_Y_FREE: "bg-fuchsia-50 text-fuchsia-700",
  MAXIMUM_ORDER_QUANTITY: "bg-teal-50 text-teal-700",
  RESTRICT_PRODUCT_VISIBILITY: "bg-slate-50 text-slate-700",
  HIDDEN_PRICE: "bg-gray-50 text-gray-700",
  NON_PURCHASABLE: "bg-neutral-50 text-neutral-700",
  LOYALTY_ORDER_EARN: "bg-emerald-50 text-emerald-700",
  LOYALTY_CATEGORY_BONUS: "bg-teal-50 text-teal-700",
  LOYALTY_FIRST_ORDER_BONUS: "bg-lime-50 text-lime-700",
  LOYALTY_REVIEW_BONUS: "bg-sky-50 text-sky-700",
  LOYALTY_REFERRAL_BONUS: "bg-violet-50 text-violet-700",
}

type RuleForm = {
  name: string
  type: string
  description: string
  priority: string
  isActive: boolean
  conditions: Record<string, any>
  actions: Record<string, any>
  startDate: string
  endDate: string
}

const emptyForm = (): RuleForm => ({
  name: "",
  type: "PRODUCT_DISCOUNT",
  description: "",
  priority: "0",
  isActive: true,
  conditions: {},
  actions: {},
  startDate: "",
  endDate: "",
})

function ConditionsActionsFields({ form, setForm, products, categories, roles }: { form: RuleForm; setForm: React.Dispatch<React.SetStateAction<RuleForm>>; products: Product[]; categories: Category[]; roles: { id: string; name: string; label: string; color: string | null }[] }) {
  const t = form.type
  const c = form.conditions
  const a = form.actions
  const updateC = (key: string, val: any) => setForm((f) => ({ ...f, conditions: { ...f.conditions, [key]: val } }))
  const updateA = (key: string, val: any) => setForm((f) => ({ ...f, actions: { ...f.actions, [key]: val } }))

  const productSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option value="">Select product</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </div>
  )

  const categorySelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option value="">All categories</option>
        {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
      </select>
    </div>
  )

  const discountFields = (showProductCat = true, showMinQty = false) => (
    <>
      {showProductCat && (
        <>
          {productSelect("Product", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
        </>
      )}
      {showMinQty && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Quantity</label>
          <input type="number" value={c.minQty || ""} onChange={(e) => updateC("minQty", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 10" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
        <select value={a.discountType || "PERCENTAGE"} onChange={(e) => updateA("discountType", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="PERCENTAGE">Percentage (%)</option>
          <option value="FLAT">Flat Amount</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
        <input type="number" step="0.01" value={a.discountValue ?? ""} onChange={(e) => updateA("discountValue", e.target.value ? Number(e.target.value) : undefined)} placeholder={a.discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 500"} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
    </>
  )

  const roleSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option value="">Select role</option>
        {roles.map((r) => (
          <option key={r.id} value={r.name}>{r.label}</option>
        ))}
      </select>
    </div>
  )

  switch (t) {
    case "PRODUCT_DISCOUNT":
      return <>{discountFields(true, true)}</>

    case "CART_DISCOUNT":
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Subtotal</label>
            <input type="number" step="0.01" value={c.minSubtotal || ""} onChange={(e) => updateC("minSubtotal", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 5000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
            <select value={a.discountType || "PERCENTAGE"} onChange={(e) => updateA("discountType", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
            <input type="number" step="0.01" value={a.discountValue ?? ""} onChange={(e) => updateA("discountValue", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 10" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "PAYMENT_METHOD_DISCOUNT":
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={c.paymentMethod || ""} onChange={(e) => updateC("paymentMethod", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select method</option>
              <option value="COD">Cash on Delivery</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="NET_BANKING">Net Banking</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
            <select value={a.discountType || "PERCENTAGE"} onChange={(e) => updateA("discountType", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
            <input type="number" step="0.01" value={a.discountValue ?? ""} onChange={(e) => updateA("discountValue", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 5" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "REQUIRED_QTY_FOR_PAYMENT_METHOD":
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={c.paymentMethod || ""} onChange={(e) => updateC("paymentMethod", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select method</option>
              <option value="COD">Cash on Delivery</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="UPI">UPI</option>
              <option value="NET_BANKING">Net Banking</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Quantity Required</label>
            <input type="number" value={c.minQty || ""} onChange={(e) => updateC("minQty", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "BOGO":
    case "BUY_X_AND_Y_FREE":
      return (
        <>
          {productSelect("Buy Product", c.buyProductId || "", (v) => updateC("buyProductId", v))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buy Quantity</label>
            <input type="number" value={c.buyQuantity || ""} onChange={(e) => updateC("buyQuantity", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 3" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {productSelect("Get Free Product", a.freeProductId || "", (v) => updateA("freeProductId", v))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Free Quantity</label>
            <input type="number" value={a.freeQuantity || ""} onChange={(e) => updateA("freeQuantity", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "SHIPPING_RULE":
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Value</label>
            <input type="number" step="0.01" value={c.minOrderValue || ""} onChange={(e) => updateC("minOrderValue", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1000 (leave empty for any)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <input type="text" value={c.region || ""} onChange={(e) => updateC("region", e.target.value || undefined)} placeholder="e.g. Maharashtra (leave empty for all)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Type</label>
            <select value={a.shippingType || "FREE"} onChange={(e) => updateA("shippingType", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="FREE">Free Shipping</option>
              <option value="FLAT_RATE">Flat Rate</option>
              <option value="CONDITIONAL">Conditional</option>
            </select>
          </div>
          {a.shippingType === "FLAT_RATE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Flat Rate Amount</label>
              <input type="number" step="0.01" value={a.flatRate ?? ""} onChange={(e) => updateA("flatRate", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 99" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          )}
        </>
      )

    case "MINIMUM_ORDER_QUANTITY":
      return (
        <>
          {productSelect("Product (optional)", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Quantity</label>
            <input type="number" value={a.minQty || ""} onChange={(e) => updateA("minQty", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 10" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "TAX_RULE":
      return (
        <>
          {productSelect("Product (optional)", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region (optional)</label>
            <input type="text" value={c.region || ""} onChange={(e) => updateC("region", e.target.value || undefined)} placeholder="e.g. Maharashtra" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
            <input type="number" step="0.01" value={a.taxRate ?? ""} onChange={(e) => updateA("taxRate", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 18" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Label</label>
            <input type="text" value={a.taxLabel || ""} onChange={(e) => updateA("taxLabel", e.target.value || undefined)} placeholder="e.g. GST" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "CHECKOUT_RESTRICTION":
      return (
        <>
          {productSelect("Product (optional)", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          {roleSelect("Restricted Role", c.roleIds?.[0] || "", (v) => updateC("roleIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Restriction Type</label>
            <input type="text" value={a.restrictionType || ""} onChange={(e) => updateA("restrictionType", e.target.value || undefined)} placeholder="e.g. REGION_BLOCK" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={a.message || ""} onChange={(e) => updateA("message", e.target.value || undefined)} placeholder="Restriction message shown to user" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "QUANTITY_BASED_DISCOUNT":
      return (
        <>
          {productSelect("Product (optional)", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div className="col-span-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Tiers</label>
            {(a.tiers || []).map((tier: any, i: number) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="number" value={tier.minQty || ""} onChange={(e) => { const tiers = [...(a.tiers || [])]; tiers[i] = { ...tiers[i], minQty: Number(e.target.value) }; updateA("tiers", tiers) }} placeholder="Min Qty" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <select value={tier.discountType || "PERCENTAGE"} onChange={(e) => { const tiers = [...(a.tiers || [])]; tiers[i] = { ...tiers[i], discountType: e.target.value }; updateA("tiers", tiers) }} className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="PERCENTAGE">%</option>
                  <option value="FLAT">Flat</option>
                </select>
                <input type="number" step="0.01" value={tier.discountValue || ""} onChange={(e) => { const tiers = [...(a.tiers || [])]; tiers[i] = { ...tiers[i], discountValue: Number(e.target.value) }; updateA("tiers", tiers) }} placeholder="Value" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button type="button" onClick={() => updateA("tiers", (a.tiers || []).filter((_: any, idx: number) => idx !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => updateA("tiers", [...(a.tiers || []), { minQty: 0, discountType: "PERCENTAGE", discountValue: 0 }])} className="text-sm text-primary-600 hover:text-primary-700">+ Add Tier</button>
          </div>
        </>
      )

    case "EXTRA_CHARGE":
      return (
        <>
          {productSelect("Product (optional)", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type</label>
            <select value={a.chargeType || "FLAT"} onChange={(e) => updateA("chargeType", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charge Value</label>
            <input type="number" step="0.01" value={a.chargeValue ?? ""} onChange={(e) => updateA("chargeValue", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charge Label</label>
            <input type="text" value={a.chargeLabel || ""} onChange={(e) => updateA("chargeLabel", e.target.value)} placeholder="e.g. Handling Fee" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "MAXIMUM_ORDER_QUANTITY":
      return (
        <>
          {productSelect("Product (optional)", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
            <input type="number" value={a.maxQty || ""} onChange={(e) => updateA("maxQty", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 100" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "RESTRICT_PRODUCT_VISIBILITY":
    case "HIDDEN_PRICE":
      return (
        <>
          {productSelect("Product", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          {roleSelect("Apply to Role", c.roleIds?.[0] || "", (v) => updateC("roleIds", v ? [v] : []))}
        </>
      )

    case "NON_PURCHASABLE":
      return (
        <>
          {productSelect("Product", c.productIds?.[0] || "", (v) => updateC("productIds", v ? [v] : []))}
          {categorySelect("Category (optional)", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
            <textarea value={a.message || ""} onChange={(e) => updateA("message", e.target.value || undefined)} placeholder="Message shown when trying to purchase" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </>
      )

    case "LOYALTY_ORDER_EARN":
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount (₹)</label>
            <input type="number" step="0.01" value={c.minOrderAmount || ""} onChange={(e) => updateC("minOrderAmount", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 0 (no minimum)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {roleSelect("Apply to Role (optional)", c.roleIds?.[0] || "", (v) => updateC("roleIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points per Unit</label>
            <input type="number" value={a.pointsPerUnit ?? ""} onChange={(e) => updateA("pointsPerUnit", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 10" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Amount (₹)</label>
            <input type="number" step="0.01" value={a.unitAmount ?? ""} onChange={(e) => updateA("unitAmount", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <p className="col-span-full text-xs text-gray-500">Users earn {a.pointsPerUnit || "?"} points for every ₹{a.unitAmount || "?"} spent on an order</p>
        </>
      )

    case "LOYALTY_CATEGORY_BONUS":
      return (
        <>
          {categorySelect("Category", c.categoryIds?.[0] || "", (v) => updateC("categoryIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount (₹, optional)</label>
            <input type="number" step="0.01" value={c.minOrderAmount || ""} onChange={(e) => updateC("minOrderAmount", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 500" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Points</label>
            <input type="number" value={a.bonusPoints ?? ""} onChange={(e) => updateA("bonusPoints", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <p className="col-span-full text-xs text-gray-500">Users earn {a.bonusPoints || "?"} bonus points when purchasing from the selected category</p>
        </>
      )

    case "LOYALTY_FIRST_ORDER_BONUS":
      return (
        <>
          {roleSelect("Apply to Role (optional)", c.roleIds?.[0] || "", (v) => updateC("roleIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Points</label>
            <input type="number" value={a.bonusPoints ?? ""} onChange={(e) => updateA("bonusPoints", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 100" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <p className="col-span-full text-xs text-gray-500">Users earn {a.bonusPoints || "?"} bonus points on their first order</p>
        </>
      )

    case "LOYALTY_REVIEW_BONUS":
      return (
        <>
          {roleSelect("Apply to Role (optional)", c.roleIds?.[0] || "", (v) => updateC("roleIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Rating (1-5, optional)</label>
            <input type="number" min="1" max="5" value={c.minRating || ""} onChange={(e) => updateC("minRating", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 3" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Points</label>
            <input type="number" value={a.bonusPoints ?? ""} onChange={(e) => updateA("bonusPoints", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 25" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <p className="col-span-full text-xs text-gray-500">Users earn {a.bonusPoints || "?"} points for writing a review{c.minRating ? ` with rating ≥ ${c.minRating}` : ""}</p>
        </>
      )

    case "LOYALTY_REFERRAL_BONUS":
      return (
        <>
          {roleSelect("Apply to Role (optional)", c.roleIds?.[0] || "", (v) => updateC("roleIds", v ? [v] : []))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount for Referred User (₹, optional)</label>
            <input type="number" step="0.01" value={c.minOrderAmount || ""} onChange={(e) => updateC("minOrderAmount", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 500" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Referrer Points</label>
            <input type="number" value={a.referrerPoints ?? ""} onChange={(e) => updateA("referrerPoints", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 200" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Referred User Points (optional)</label>
            <input type="number" value={a.referredPoints ?? ""} onChange={(e) => updateA("referredPoints", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <p className="col-span-full text-xs text-gray-500">Referrer earns {a.referrerPoints || "?"} pts{a.referredPoints ? `, referred user earns ${a.referredPoints} pts` : ""} when referred user completes first order</p>
        </>
      )

    default:
      return null
  }
}

export default function AdminRulesPage() {
  const [rules, setRules] = useState<DynamicRule[]>([])
  const [filtered, setFiltered] = useState<DynamicRule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string; label: string; color: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DynamicRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<RuleForm>(emptyForm())
  const [filterType, setFilterType] = useState("")

  const getAuthHeaders = (): Record<string, string> => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const headers: Record<string, string> = {}
    if (t) headers["Authorization"] = `Bearer ${t}`
    return headers
  }

  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!t) {
      window.location.href = "/login"
      throw new Error("Not authenticated")
    }
    const headers: Record<string, string> = { ...options.headers as Record<string, string>, Authorization: `Bearer ${t}` }
    const res = await fetch(url, { ...options, headers })
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token")
      window.location.href = "/login"
      throw new Error("Session expired. Please log in again.")
    }
    return res
  }

  useEffect(() => { loadRules(); loadProducts(); loadCategories(); loadRoles() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(rules.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
      const matchType = !filterType || r.type === filterType
      return matchSearch && matchType
    }))
  }, [rules, search, filterType])

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/rules", { headers: getAuthHeaders() })
      const data = await res.json()
      setRules(Array.isArray(data) ? data : data.rules ?? [])
      setFiltered(Array.isArray(data) ? data : data.rules ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?status=PUBLISHED,DRAFT,ARCHIVED", { headers: getAuthHeaders() })
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch (e) { console.error(e) }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      const flat: Category[] = []
      const walk = (arr: any[]) => { for (const c of arr || []) { flat.push({ id: c.id, name: c.name }); walk(c.children) } }
      walk(data.categories || [])
      setCategories(flat)
    } catch (e) { console.error(e) }
  }

  const loadRoles = async () => {
    try {
      const res = await fetch("/api/roles", { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setRoles((data.roles || []).map((r: any) => ({ id: r.id, name: r.name, label: r.label, color: r.color })))
      }
    } catch (e) { console.error(e) }
  }

  const resetForm = () => { setForm(emptyForm()); setEditing(null); setShowForm(false) }

  const openEdit = (r: DynamicRule) => {
    setEditing(r)
    setForm({
      name: r.name,
      type: r.type,
      description: r.description || "",
      priority: String(r.priority),
      isActive: r.isActive,
      conditions: r.conditions as Record<string, any>,
      actions: r.actions as Record<string, any>,
      startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "",
      endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "",
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!t) {
      alert("Your session has expired. Please log in again.")
      window.location.href = "/login"
      return
    }
    setSaving(true)
    const body: any = {
      name: form.name,
      type: form.type,
      description: form.description || null,
      priority: Number(form.priority) || 0,
      isActive: form.isActive,
      conditions: form.conditions,
      actions: form.actions,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    }
    try {
      const res = await authFetch(editing ? `/api/rules/${editing.id}` : "/api/rules", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) { resetForm(); loadRules() }
      else {
        let msg = "Failed to save rule"
        try { const d = await res.json(); msg = d.message || msg } catch {}
        alert(msg)
      }
    } catch (e) { console.error(e); alert(e instanceof Error ? e.message : "Failed to save") } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return
    try {
      await authFetch(`/api/rules/${id}`, { method: "DELETE" })
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (e) { console.error(e) }
  }

  const handleToggle = async (id: string) => {
    try {
      const res = await authFetch(`/api/rules/${id}/toggle`, { method: "PATCH" })
      if (res.ok) loadRules()
    } catch (e) { console.error(e) }
  }

  const getTypeLabel = (type: string) => RULE_TYPES.find((r) => r.value === type)?.label || type

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dynamic Rules</h1>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Add Rule</button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search rules..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Types</option>
          {RULE_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{editing ? "Edit Rule" : "Add Dynamic Rule"}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input required placeholder="Rule Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, conditions: {}, actions: {} })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {RULE_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
            </select>
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="number" placeholder="Priority (lower = higher)" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />

            <div className="col-span-full border-t border-gray-100 pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Conditions & Actions for: {getTypeLabel(form.type)}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ConditionsActionsFields form={form} setForm={setForm} products={products} categories={categories} roles={roles} />
              </div>
            </div>

            <div className="col-span-full flex gap-3 pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><p className="text-gray-600">No rules found. Click "Add Rule" to create one.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Dates</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3"><div className="font-medium text-gray-900">{r.name}</div>{r.description && <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[r.type] || "bg-gray-50 text-gray-700"}`}>{getTypeLabel(r.type)}</span></td>
                  <td className="px-4 py-3 text-gray-600">{r.priority}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.startDate ? new Date(r.startDate).toLocaleDateString() : "—"} {r.endDate ? `→ ${new Date(r.endDate).toLocaleDateString()}` : ""}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(r.id)} className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${r.isActive ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}