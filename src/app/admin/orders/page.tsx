"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, ChevronDown, ChevronUp, Eye } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"
import { AdminStatusBadge, type AdminBadgeVariant } from "@/lib/adminStatusBadge"
import { ListFilterBar, emptyValues, type FilterField, type FilterValues } from "@/components/admin/ListFilters"
import { paymentModeLabel, PAYMENT_STATUS_OPTIONS } from "@/lib/paymentMode"

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  paymentStatus: string
  createdAt: string
  user: { firstName: string; lastName: string; email: string } | null
  items: { product: { title: string }; quantity: number; unitPrice: number; metadata?: any }[]
  trackingNumber?: string | null
  carrier?: string | null
  deliveryPartnerId?: string | null
  deliveryPartner?: { id: string; name: string; code: string; trackingUrlTemplate: string | null } | null
  payment?: {
    provider?: string
    status: string
    amount?: number
    refunds?: { id: string; amount: number; status: string; reason: string | null; createdAt: string }[]
  } | null
}

const REFUND_STATUSES = ["PENDING", "APPROVED", "REJECTED", "PROCESSED"] as const

const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Refund Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PROCESSED: "Refunded",
  FAILED: "Failed",
}

function latestRefund(o: Order) {
  return o.payment?.refunds?.[0] || null
}

const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

const ORDER_FILTER_FIELDS: FilterField[] = [
  { type: "multi", key: "status", label: "Order Status", options: statuses.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) },
  { type: "multi", key: "payment", label: "Payment Status", options: PAYMENT_STATUS_OPTIONS },
  { type: "number", key: "minTotal", label: "Minimum Total Amount (₹)", placeholder: "e.g. 5000", hint: "Shows orders with this total or more" },
  { type: "select", key: "refund", label: "Refund", allLabel: "All refunds", options: REFUND_STATUSES.map((s) => ({ value: s, label: REFUND_STATUS_LABELS[s] })) },
]

// An order with no payment record yet (e.g. Cash on Delivery) counts as a pending payment.
const orderPaymentStatus = (o: Order) => (o.payment?.status || o.paymentStatus || "PENDING").toUpperCase()

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filtered, setFiltered] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [ofilters, setOfilters] = useState<FilterValues>(emptyValues(ORDER_FILTER_FIELDS))
  const [sortKey, setSortKey] = useState<keyof Order>("createdAt")
  const [sortDesc, setSortDesc] = useState(true)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadOrders()
  }, [token])

  useEffect(() => {
    let result = [...orders]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.user?.email?.toLowerCase().includes(q) ||
          o.user?.firstName?.toLowerCase().includes(q)
      )
    }
    const statusSel = ofilters.status as string[]
    if (statusSel.length) result = result.filter((o) => statusSel.includes(o.status))
    const paySel = ofilters.payment as string[]
    if (paySel.length) result = result.filter((o) => paySel.includes(orderPaymentStatus(o)))
    if (ofilters.minTotal !== "") result = result.filter((o) => Number(o.totalAmount) >= Number(ofilters.minTotal))
    if (ofilters.refund) result = result.filter((o) => latestRefund(o)?.status === ofilters.refund)
    result.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string
      const bv = (b[sortKey] ?? "") as string
      return sortDesc ? (bv > av ? 1 : -1) : av > bv ? 1 : -1
    })
    setFiltered(result)
  }, [orders, search, ofilters, sortKey, sortDesc])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const SortIcon = ({ col }: { col: keyof Order }) => {
    if (sortKey !== col) return <ChevronDown size={14} className="text-gray-300 dark:text-gray-600" />
    return sortDesc ? <ChevronDown size={14} className="text-primary-600 dark:text-primary-400" /> : <ChevronUp size={14} className="text-primary-600 dark:text-primary-400" />
  }

  function orderStatusBadgeProps(status: string): { variant?: AdminBadgeVariant; colorClassName?: string } {
    switch (status) {
      case "PENDING": return { variant: "warning" }
      case "PROCESSING": return { variant: "primary" }
      case "SHIPPED": return { colorClassName: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" }
      case "DELIVERED": return { variant: "success" }
      case "CANCELLED": return { variant: "neutral" }
      default: return { variant: "neutral" }
    }
  }

  const statusBadge = (status: string) => <AdminStatusBadge status={status} {...orderStatusBadgeProps(status)} />

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm w-full"
        />
      </div>
      <ListFilterBar fields={ORDER_FILTER_FIELDS} values={ofilters} onValues={setOfilters} resultCount={filtered.length} totalCount={orders.length} noun="orders" />

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <div className="admin-card-static overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {[
                    { key: "orderNumber" as const, label: "Order" },
                    { key: "status" as const, label: "Status" },
                    { key: "totalAmount" as const, label: "Total" },
                    { key: "paymentStatus" as const, label: "Payment" },
                    { key: "createdAt" as const, label: "Date" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 select-none"
                      onClick={() => {
                        if (sortKey === col.key) setSortDesc(!sortDesc)
                        else { setSortKey(col.key); setSortDesc(true) }
                      }}
                    >
                      <div className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      <Link href={`/admin/orders/${o.id}`} className="hover:text-primary-600 dark:hover:text-primary-400">#{o.orderNumber}</Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{o.user ? `${o.user.firstName} ${o.user.lastName}` : "Guest"}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(o.status)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(o.totalAmount))}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      <span className="uppercase">{o.payment?.status || o.paymentStatus || 'N/A'}</span>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{paymentModeLabel(o.payment?.provider)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/orders/${o.id}`} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30" title="View"><Eye size={16} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}