"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Printer, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/StatusBadge"

interface InvoiceOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  currency: string
  createdAt: string
  shippingAddress: any
  billingAddress: any
  items: { id: string; quantity: number; unitPrice: number; totalPrice: number; product: { title: string; sku: string | null } }[]
  payment: { provider: string; status: string; providerRef: string | null } | null
  user: { firstName: string; lastName: string; email: string; phone: string | null }
}

export default function InvoicePage() {
  const params = useParams()
  const router = useRouter()
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const [order, setOrder] = useState<InvoiceOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setOrder(data.order || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id, router])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>
  if (!order) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Package size={40} className="text-gray-300" />
      <p className="text-gray-500">Order not found</p>
      <Link href="/orders" className="text-primary-600 font-medium">Back to orders</Link>
    </div>
  )

  const address = (addr: any) => addr ? (
    <>
      <p>{addr.street}</p>
      <p>{addr.city}, {addr.state} {addr.zip}</p>
      <p>{addr.country}</p>
    </>
  ) : <p>—</p>

  const subtotal = order.items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const shippingFee = 0
  const taxAmount = Math.max(0, Number(order.totalAmount) - subtotal - shippingFee)

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <style>{`@media print { header, footer, .no-print { display: none !important; } body { background: white !important; } }`}</style>

      <div className="max-w-3xl mx-auto no-print flex items-center justify-between mb-4 px-4">
        <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary-600">
          <ArrowLeft size={16} /> Back to order
        </Link>
        <button onClick={() => window.print()} className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2">
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto card-base-static print:shadow-none print:rounded-none print:border-none p-8 sm:p-12">
        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b-2 border-gray-900/5">
          <div>
            <h1 className="heading-md">{siteName}</h1>
            <p className="text-xs text-gray-500 mt-1">B2B Wholesale E-Commerce Platform</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-extrabold text-primary-700 uppercase tracking-wide">Tax Invoice</h2>
            <p className="text-xs text-gray-500 mt-1">Invoice #{order.orderNumber.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Bill to / Ship to */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-gray-200">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Billed To</p>
            <p className="text-sm font-semibold text-gray-900">{order.user.firstName} {order.user.lastName}</p>
            <p className="text-xs text-gray-500 mb-1">{order.user.email}{order.user.phone ? ` · ${order.user.phone}` : ""}</p>
            <div className="text-xs text-gray-600 leading-relaxed">{address(order.billingAddress || order.shippingAddress)}</div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Shipped To</p>
            <div className="text-xs text-gray-600 leading-relaxed">{address(order.shippingAddress)}</div>
          </div>
        </div>

        {/* Items table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                <th className="pb-2">Item</th>
                <th className="pb-2">SKU</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-gray-900">{item.product.title}</td>
                  <td className="py-2.5 text-gray-500">{item.product.sku || "—"}</td>
                  <td className="py-2.5 text-center text-gray-700">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-700">{formatPrice(Number(item.unitPrice))}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{formatPrice(Number(item.totalPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end pb-6 border-b border-gray-200">
          <div className="w-full max-w-xs text-sm text-gray-600 space-y-2">
            <div className="flex justify-between"><span>Subtotal</span><span className="text-gray-900">{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span className="text-gray-900">{shippingFee === 0 ? "Free" : formatPrice(shippingFee)}</span></div>
            <div className="flex justify-between"><span>GST / Taxes</span><span className="text-gray-900">{formatPrice(taxAmount)}</span></div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200"><span className="text-gray-900">Grand Total</span><span className="text-primary-700">{formatPrice(Number(order.totalAmount))}</span></div>
          </div>
        </div>

        {/* Payment details */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Payment Details</p>
            <div className="text-xs text-gray-600 space-y-1.5">
              <p>Method: <span className="text-gray-900 font-medium">{order.payment?.provider || "COD"}</span></p>
              <div className="flex items-center gap-1.5">Status: <PaymentStatusBadge status={order.payment?.status || "PENDING"} size="sm" /></div>
              {order.payment?.providerRef && <p>Transaction ID: <span className="text-gray-900 font-medium">{order.payment.providerRef}</span></p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Order Status</p>
            <OrderStatusBadge status={order.status} size="sm" />
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-10 pt-6 border-t border-gray-100">
          This is a computer-generated invoice and does not require a signature.
        </p>
      </div>
    </div>
  )
}
