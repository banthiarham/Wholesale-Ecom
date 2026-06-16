"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, ChevronDown, ChevronUp, Eye, Truck, X, ExternalLink, Plug, Layers } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SkeletonTable } from "@/components/admin/Skeleton"

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
  payment?: { status: string } | null
}

interface Partner {
  id: string
  name: string
  code: string
  apiEnabled: boolean
  testMode: boolean
  trackingUrlTemplate?: string | null
}

const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filtered, setFiltered] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sortKey, setSortKey] = useState<keyof Order>("createdAt")
  const [sortDesc, setSortDesc] = useState(true)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState("")
  const [carrier, setCarrier] = useState("")
  const [selectedPartnerId, setSelectedPartnerId] = useState("")
  const [partners, setPartners] = useState<Partner[]>([])
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [createShipmentLoading, setCreateShipmentLoading] = useState(false)
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadOrders()
    fetch("/api/delivery-partners").then((r) => r.json()).then(setPartners).catch((err) => { console.error("Failed to fetch delivery partners:", err) })
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
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter)
    }
    result.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string
      const bv = (b[sortKey] ?? "") as string
      return sortDesc ? (bv > av ? 1 : -1) : av > bv ? 1 : -1
    })
    setFiltered(result)
  }, [orders, search, statusFilter, sortKey, sortDesc])

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

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
      if (detailOrder?.id === id) setDetailOrder((prev) => (prev ? { ...prev, status } : null))
    } catch (err) {
      console.error(err)
      alert("Failed to update status")
    }
  }

  const cancelOrder = async (id: string) => {
    if (!confirm("Cancel this order?")) return
    try {
      await fetch(`/api/orders/${id}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "CANCELLED" } : o)))
      if (detailOrder?.id === id) setDetailOrder((prev) => (prev ? { ...prev, status: "CANCELLED" } : null))
    } catch (err) {
      console.error(err)
      alert("Failed to cancel order")
    }
  }

  const updateTracking = async () => {
    if (!detailOrder) return
    setTrackingLoading(true)
    try {
      const payload: any = {}
      if (trackingNumber) payload.trackingNumber = trackingNumber
      if (carrier) payload.carrier = carrier
      if (selectedPartnerId) payload.deliveryPartnerId = selectedPartnerId
      await fetch(`/api/orders/${detailOrder.id}/tracking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      setShowTracking(false)
      setTrackingNumber("")
      setCarrier("")
      setSelectedPartnerId("")
      loadOrders()
    } catch (err) {
      console.error(err)
      alert("Failed to update tracking")
    } finally {
      setTrackingLoading(false)
    }
  }

  const createShipment = async () => {
    if (!detailOrder) return
    setCreateShipmentLoading(true)
    try {
      const res = await fetch(`/api/orders/${detailOrder.id}/create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Failed to create shipment")
      setShowTracking(false)
      setTrackingNumber("")
      setCarrier("")
      setSelectedPartnerId("")
      loadOrders()
    } catch (err) {
      console.error(err)
      alert("Failed to create shipment")
    } finally {
      setCreateShipmentLoading(false)
    }
  }

  const SortIcon = ({ col }: { col: keyof Order }) => {
    if (sortKey !== col) return <ChevronDown size={14} className="text-gray-300 dark:text-gray-600" />
    return sortDesc ? <ChevronDown size={14} className="text-primary-600 dark:text-primary-400" /> : <ChevronUp size={14} className="text-primary-600 dark:text-primary-400" />
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      PROCESSING: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
      SHIPPED: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
      DELIVERED: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    }
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${colors[status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
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
                      #{o.orderNumber}
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{o.user ? `${o.user.firstName} ${o.user.lastName}` : "Guest"}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(o.status)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatPrice(Number(o.totalAmount))}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 uppercase text-xs">{o.payment?.status || o.paymentStatus || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setDetailOrder(o)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30" title="View"><Eye size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Order #{detailOrder.orderNumber}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(detailOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                {statusBadge(detailOrder.status)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Customer</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {detailOrder.user ? `${detailOrder.user.firstName} ${detailOrder.user.lastName} (${detailOrder.user.email})` : "Guest"}
                </span>
              </div>

              {(detailOrder.deliveryPartner || detailOrder.trackingNumber) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Delivery</span>
                  <div className="text-right">
                    {detailOrder.deliveryPartner && <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{detailOrder.deliveryPartner.name}</span>}
                    {detailOrder.trackingNumber && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{detailOrder.trackingNumber}</p>}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Items</h4>
                <div className="space-y-2">
                  {(() => {
                    const packageGroups = new Map<string, any[]>()
                    const standaloneItems: any[] = []
                    for (const item of detailOrder.items || []) {
                      const packageId = item.metadata?.packageId
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
                          const firstMeta = items[0].metadata
                          const packageTitle = firstMeta?.packageTitle || "Custom Package"
                          const selectedComponents = firstMeta?.selectedComponents || []
                          const groupDiscounts = firstMeta?.groupDiscounts || []
                          const packageTotal = firstMeta?.packageTotal ?? items.reduce((sum: number, i: any) => sum + Number(i.unitPrice) * i.quantity, 0)
                          return (
                            <div key={packageId} className="bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 p-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Layers size={14} className="text-primary-600 dark:text-primary-400" />
                                <span className="text-sm font-semibold text-primary-800 dark:text-primary-300">{packageTitle}</span>
                                <span className="text-[10px] bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full">Package</span>
                              </div>
                              {selectedComponents.length > 0 ? selectedComponents.map((comp: any) => (
                                <div key={comp.productId} className="flex justify-between text-xs ml-5">
                                  <span className="text-gray-700 dark:text-gray-300"><span className="text-gray-400 dark:text-gray-500">{comp.groupName}:</span> {comp.productTitle}</span>
                                  <span className="text-gray-600 dark:text-gray-400">{formatPrice(comp.unitPrice)}</span>
                                </div>
                              )) : items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs ml-5">
                                  <span className="text-gray-700 dark:text-gray-300">{item.product.title} × {item.quantity}</span>
                                  <span className="text-gray-600 dark:text-gray-400">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                                </div>
                              ))}
                              {groupDiscounts.length > 0 && (
                                <div className="ml-5 mt-1">
                                  {groupDiscounts.map((d: any, i: number) => (
                                    <div key={i} className="flex justify-between text-xs text-green-600 dark:text-green-400">
                                      <span>{d.groupName} discount</span>
                                      <span>-{formatPrice(d.discountAmount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex justify-between text-sm font-bold mt-1 border-t border-primary-200 dark:border-primary-700 pt-1">
                                <span className="text-gray-900 dark:text-gray-100">Package Total</span>
                                <span className="text-primary-700 dark:text-primary-400">{formatPrice(packageTotal)}</span>
                              </div>
                            </div>
                          )
                        })}
                        {standaloneItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{item.product.title} × {item.quantity}</span>
                            <span className="font-medium">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                <span className="text-lg font-bold text-primary-700 dark:text-primary-400">{formatPrice(Number(detailOrder.totalAmount))}</span>
              </div>

                  {detailOrder.status !== "CANCELLED" && detailOrder.status !== "DELIVERED" && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Update Status:</p>
                  <div className="flex flex-wrap gap-2">
                    {statuses.filter((s) => s !== detailOrder.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(detailOrder.id, s)}
                        className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 dark:text-gray-200 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 transition"
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => cancelOrder(detailOrder.id)}
                      className="px-3 py-1.5 text-xs border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              )}

              {/* Update Tracking */}
              {detailOrder.status !== "CANCELLED" && (
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => setShowTracking(!showTracking)} className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition">
                    <Truck size={16} /> Update Tracking
                  </button>
                  {showTracking && (
                    <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="">Select Delivery Partner (optional)</option>
                          {partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                        </select>
                        {selectedPartnerId && (() => {
                          const partner = partners.find((p) => p.id === selectedPartnerId)
                          return partner?.apiEnabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                              <Plug size={12} /> API Connected
                            </span>
                          ) : null
                        })()}
                      </div>
                      <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking Number" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      {!selectedPartnerId && (
                        <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier name (auto-filled from partner)" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      )}
                      {selectedPartnerId && trackingNumber && (() => {
                        const partner = partners.find((p) => p.id === selectedPartnerId)
                        if (partner?.trackingUrlTemplate) {
                          const url = partner.trackingUrlTemplate.replace("{trackingNumber}", trackingNumber)
                          return <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"><ExternalLink size={12} /> Preview tracking link</a>
                        }
                        return null
                      })()}
                      <div className="flex items-center gap-2">
                        <button onClick={updateTracking} disabled={trackingLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{trackingLoading ? "Updating..." : "Save Tracking"}</button>
                        {selectedPartnerId && (() => {
                          const partner = partners.find((p) => p.id === selectedPartnerId)
                          return partner?.apiEnabled ? (
                            <button onClick={createShipment} disabled={createShipmentLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                              <Truck size={14} />
                              {createShipmentLoading ? "Creating..." : `Create Shipment via ${partner.name}`}
                            </button>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}