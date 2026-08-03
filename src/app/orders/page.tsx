"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ShoppingBag, Package, Clock, CheckCircle2, XCircle, Truck, RefreshCcw,
  Search, ArrowUpDown, ChevronRight,
} from "lucide-react"
import { getCartSessionId } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { useCartDrawer } from "@/components/ui/CartDrawer"
import { EmptyState } from "@/components/ui/EmptyState"
import { OrderCard, type Order } from "@/components/orders/OrderCard"

const STATUS_FILTERS = ["All", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

type SortOption = "newest" | "oldest" | "amount_desc" | "amount_asc"

// Shared per-status color language used across the stat tiles and filter chips
// so "Pending" always reads orange, "Shipped" always reads cyan, etc.
const STATUS_THEME: Record<StatusFilter, { icon: any; iconBg: string; tileBg: string; chipActive: string }> = {
  All: { icon: Package, iconBg: "bg-primary-600", tileBg: "bg-primary-50/70 border-primary-100", chipActive: "bg-primary-600 border-primary-600" },
  PENDING: { icon: Clock, iconBg: "bg-orange-500", tileBg: "bg-orange-50/70 border-orange-100", chipActive: "bg-orange-500 border-orange-500" },
  CONFIRMED: { icon: CheckCircle2, iconBg: "bg-blue-500", tileBg: "bg-blue-50/70 border-blue-100", chipActive: "bg-blue-500 border-blue-500" },
  PROCESSING: { icon: RefreshCcw, iconBg: "bg-purple-500", tileBg: "bg-purple-50/70 border-purple-100", chipActive: "bg-purple-500 border-purple-500" },
  SHIPPED: { icon: Truck, iconBg: "bg-cyan-500", tileBg: "bg-cyan-50/70 border-cyan-100", chipActive: "bg-cyan-500 border-cyan-500" },
  DELIVERED: { icon: CheckCircle2, iconBg: "bg-green-500", tileBg: "bg-green-50/70 border-green-100", chipActive: "bg-green-500 border-green-500" },
  CANCELLED: { icon: XCircle, iconBg: "bg-red-500", tileBg: "bg-red-50/70 border-red-100", chipActive: "bg-red-500 border-red-500" },
}

const STAT_TILES: { key: StatusFilter; label: string }[] = [
  { key: "All", label: "Total Orders" },
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
]

const POLL_INTERVAL_MS = 20000

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortOption>("newest")
  const { showToast } = useToast()
  const { openCartDrawer } = useCartDrawer()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Unchanged data-fetching: one initial load + a silent poll so admin-driven
  // status changes surface without a manual refresh. Filtering/search/sort
  // below all run client-side against this same loaded array — no extra calls.
  const load = useCallback((silent = false) => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    if (!silent) setLoading(true)
    fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  const handleReorder = useCallback(async (e: React.MouseEvent, order: Order) => {
    e.preventDefault()
    e.stopPropagation()
    setReorderingId(order.id)
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": getCartSessionId() }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const results = await Promise.all(
        order.items.map((item) =>
          fetch("/api/cart", {
            method: "POST",
            headers,
            body: JSON.stringify({ productId: item.productId, quantity: item.quantity }),
          }).then((res) => res.ok)
        )
      )
      window.dispatchEvent(new CustomEvent("cart-updated"))
      const failedCount = results.filter((ok) => !ok).length
      if (failedCount === 0) {
        openCartDrawer()
      } else if (failedCount < results.length) {
        showToast("error", `${failedCount} item(s) could not be added — check stock/quantity limits`)
        openCartDrawer()
      } else {
        showToast("error", "Could not add items to cart")
      }
    } catch (err) {
      console.error(err)
      showToast("error", "Something went wrong")
    } finally {
      setReorderingId(null)
    }
  }, [openCartDrawer, showToast])

  const handleCancel = useCallback(async (e: React.MouseEvent, order: Order) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Cancel order #${order.orderNumber.slice(0, 8)}?`)) return
    setCancellingId(order.id)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)))
        showToast("success", "Order cancelled")
      } else {
        showToast("error", "Failed to cancel order")
      }
    } catch {
      showToast("error", "Something went wrong")
    } finally {
      setCancellingId(null)
    }
  }, [showToast])

  // Counts for the stat tiles and filter chip badges — one pass over the
  // already-loaded orders, recomputed only when the order list changes.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: orders.length }
    for (const s of STATUS_FILTERS) {
      if (s === "All") continue
      counts[s] = orders.filter((o) => o.status === s).length
    }
    return counts
  }, [orders])

  const visibleOrders = useMemo(() => {
    let result = statusFilter === "All" ? orders : orders.filter((o) => o.status === statusFilter)

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.trackingNumber || "").toLowerCase().includes(q) ||
        o.items.some((item) => item.product.title.toLowerCase().includes(q))
      )
    }

    const sorted = [...result]
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case "amount_desc":
        sorted.sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
        break
      case "amount_asc":
        sorted.sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount))
        break
      case "newest":
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return sorted
  }, [orders, statusFilter, search, sort])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <main className="section-container py-8 lg:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="text-[28px] lg:text-[34px] font-extrabold text-gray-900 tracking-tight leading-none">My Orders</h1>
            {!loading && (
              <p className="text-sm text-gray-500 mt-2">
                {orders.length > 0 ? <>Track, manage and reorder from your <span className="font-semibold text-gray-700">{orders.length}</span> order{orders.length !== 1 ? "s" : ""}</> : "Your order history will appear here"}
              </p>
            )}
          </div>
          <Link href="/products" className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors group shrink-0">
            Continue Shopping <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Stat tiles */}
        {!loading && orders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {STAT_TILES.map((tile) => {
              const theme = STATUS_THEME[tile.key]
              const active = statusFilter === tile.key
              return (
                <button
                  key={tile.key}
                  onClick={() => setStatusFilter(tile.key)}
                  className={`relative rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${theme.tileBg} ${
                    active ? "ring-2 ring-offset-2 ring-primary-500 shadow-md" : "shadow-sm"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-white shadow-sm ${theme.iconBg}`}>
                    <theme.icon size={18} />
                  </div>
                  <p className="text-[26px] font-extrabold text-gray-900 leading-none tracking-tight">{statusCounts[tile.key] ?? 0}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-2">{tile.label}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Sticky filter + search + sort bar */}
        {!loading && orders.length > 0 && (
          <div className="sticky-toolbar flex flex-col gap-3.5 mb-7">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {STATUS_FILTERS.map((s) => {
                const theme = STATUS_THEME[s]
                const active = statusFilter === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-shrink-0 inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap border transition-all duration-200 ${
                      active
                        ? `${theme.chipActive} text-white shadow-sm`
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {s === "All" ? "All Orders" : s.charAt(0) + s.slice(1).toLowerCase()}
                    <span className={`text-[11px] font-extrabold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>
                      {statusCounts[s] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                  type="text"
                  placeholder="Search by order ID, product name or tracking number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="relative shrink-0">
                <ArrowUpDown size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="pl-10 pr-9 py-3 border border-gray-200 rounded-2xl text-sm font-medium appearance-none bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all cursor-pointer w-full sm:w-48"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="amount_desc">Highest Amount</option>
                  <option value="amount_asc">Lowest Amount</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Start shopping to place your first order — it'll show up here with full tracking and reorder options."
            action={{ label: "Continue Shopping", href: "/products" }}
          />
        ) : visibleOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Search size={26} className="text-gray-300" />
            </div>
            <h3 className="heading-sm mb-1.5">No matching orders found</h3>
            <p className="body-sm max-w-sm">Try a different search term or clear the current filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isReordering={reorderingId === order.id}
                isCancelling={cancellingId === order.id}
                onReorder={handleReorder}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
