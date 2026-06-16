"use client"

import { useEffect, useState } from "react"
import {
  PackageCheck,
  Truck,
  Loader2,
  X,
  Plus,
  MapPin,
  Clock,
  CheckCircle2,
  Circle,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  Send,
} from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/30" },
  PICKED_UP: { label: "Picked Up", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
  IN_TRANSIT: { label: "In Transit", color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  DELIVERED: { label: "Delivered", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30" },
  FAILED: { label: "Failed", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  RETURNED: { label: "Returned", color: "text-gray-700 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
}

interface ShipmentOrder {
  id: string
  orderNumber: string
  trackingNumber: string | null
  carrier: string | null
  status: string
  createdAt: string
  user?: { firstName: string; lastName: string; email: string }
  deliveryPartner?: { id: string; name: string; code: string; trackingUrlTemplate: string | null; logo: string | null; apiEnabled: boolean; testMode: boolean } | null
  deliveryTracking?: { status: string; currentLocation: string | null; estimatedDelivery: string | null; events: { id: string; status: string; location: string | null; notes: string | null; occurredAt: string }[] } | null
}

interface Partner {
  id: string
  name: string
  code: string
  apiEnabled: boolean
  testMode: boolean
}

export default function AdminDeliveryTrackingPage() {
  const [shipments, setShipments] = useState<ShipmentOrder[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterPartner, setFilterPartner] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")
  const [detailOrder, setDetailOrder] = useState<ShipmentOrder | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState({ status: "PICKED_UP", location: "", notes: "" })
  const [addingEvent, setAddingEvent] = useState(false)
  const [syncAllLoading, setSyncAllLoading] = useState(false)
  const [syncAllResult, setSyncAllResult] = useState<any>(null)
  const [createShipmentLoading, setCreateShipmentLoading] = useState(false)
  const [syncTrackingLoading, setSyncTrackingLoading] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""

  useEffect(() => {
    Promise.all([
      fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/delivery-partners/all", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/analytics/delivery-stats", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => null),
    ]).then(([oData, pData, sData]) => {
      const allOrders: ShipmentOrder[] = oData.orders || []
      const withDelivery = allOrders.filter((o: ShipmentOrder) => o.deliveryPartner || o.trackingNumber)
      setShipments(withDelivery.length > 0 ? withDelivery : allOrders.filter((o: ShipmentOrder) => o.status === "SHIPPED" || o.status === "PROCESSING" || o.status === "DELIVERED"))
      setPartners(Array.isArray(pData) ? pData : [])
      if (sData) setStats(sData)
    }).catch((err) => { console.error("Failed to fetch shipment data:", err) }).finally(() => setLoading(false))
  }, [])

  const filtered = shipments.filter((s) => {
    if (filterPartner && s.deliveryPartner?.id !== filterPartner) return false
    if (filterStatus && s.deliveryTracking?.status !== filterStatus && !(filterStatus === "NONE" && !s.deliveryTracking)) return false
    if (search && !s.orderNumber.toLowerCase().includes(search.toLowerCase()) && !s.trackingNumber?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const addTrackingEvent = async () => {
    if (!detailOrder) return
    setAddingEvent(true)
    try {
      const res = await fetch(`/api/orders/${detailOrder.id}/delivery-tracking/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(eventForm),
      })
      const data = await res.json()
      setDetailOrder((prev) => prev ? { ...prev, deliveryTracking: data.tracking } : prev)
      setShipments((prev) => prev.map((s) => s.id === detailOrder.id ? { ...s, deliveryTracking: data.tracking } : s))
      setShowEventForm(false)
      setEventForm({ status: "PICKED_UP", location: "", notes: "" })
    } catch {
      alert("Failed to add event")
    } finally {
      setAddingEvent(false)
    }
  }

  const getTrackingUrl = (s: ShipmentOrder) => {
    if (s.deliveryPartner?.trackingUrlTemplate && s.trackingNumber) {
      return s.deliveryPartner.trackingUrlTemplate.replace("{trackingNumber}", s.trackingNumber)
    }
    return null
  }

  const syncAllTracking = async () => {
    setSyncAllLoading(true)
    setSyncAllResult(null)
    try {
      const res = await fetch("/api/delivery-partners/sync-all-tracking", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSyncAllResult(data)
    } catch {
      setSyncAllResult({ synced: 0, failed: 0, results: [], error: "Request failed" })
    } finally {
      setSyncAllLoading(false)
    }
  }

  const createShipment = async () => {
    if (!detailOrder?.deliveryPartner) return
    setCreateShipmentLoading(true)
    try {
      const res = await fetch(`/api/delivery-partners/${detailOrder.deliveryPartner.id}/create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: detailOrder.id }),
      })
      await res.json()
      // Refresh shipment data
      const ordersRes = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      const ordersData = await ordersRes.json()
      const allOrders: ShipmentOrder[] = ordersData.orders || []
      const withDelivery = allOrders.filter((o: ShipmentOrder) => o.deliveryPartner || o.trackingNumber)
      const shipmentsList = withDelivery.length > 0 ? withDelivery : allOrders.filter((o: ShipmentOrder) => o.status === "SHIPPED" || o.status === "PROCESSING" || o.status === "DELIVERED")
      setShipments(shipmentsList)
      const updated = shipmentsList.find((o: ShipmentOrder) => o.id === detailOrder.id) || null
      setDetailOrder(updated)
    } catch {
      alert("Failed to create shipment")
    } finally {
      setCreateShipmentLoading(false)
    }
  }

  const syncTracking = async () => {
    if (!detailOrder?.deliveryPartner || !detailOrder.trackingNumber) return
    setSyncTrackingLoading(true)
    try {
      const res = await fetch(`/api/delivery-partners/${detailOrder.deliveryPartner.id}/sync-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: detailOrder.id }),
      })
      const data = await res.json()
      // Refresh detail modal data
      const ordersRes = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } })
      const ordersData = await ordersRes.json()
      const allOrders: ShipmentOrder[] = ordersData.orders || []
      const withDelivery = allOrders.filter((o: ShipmentOrder) => o.deliveryPartner || o.trackingNumber)
      const shipmentsList = withDelivery.length > 0 ? withDelivery : allOrders.filter((o: ShipmentOrder) => o.status === "SHIPPED" || o.status === "PROCESSING" || o.status === "DELIVERED")
      setShipments(shipmentsList)
      const updated = shipmentsList.find((o: ShipmentOrder) => o.id === detailOrder.id) || null
      setDetailOrder(updated)
    } catch {
      alert("Failed to sync tracking")
    } finally {
      setSyncTrackingLoading(false)
    }
  }

  if (loading) {
    return <SkeletonTable />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shipment Tracking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Monitor all deliveries and tracking updates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncAllTracking}
            disabled={syncAllLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {syncAllLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync All Tracking
          </button>
          {syncAllResult && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Synced: {syncAllResult.synced ?? 0}, Failed: {syncAllResult.failed ?? 0}
            </span>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Shipments", value: stats?.totalShipments ?? shipments.length, icon: PackageCheck, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" },
          { label: "In Transit", value: stats?.byStatus?.IN_TRANSIT ?? 0, icon: Truck, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400" },
          { label: "Delivered", value: stats?.byStatus?.DELIVERED ?? 0, icon: CheckCircle2, color: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
          { label: "Failed", value: (stats?.byStatus?.FAILED ?? 0) + (stats?.byStatus?.RETURNED ?? 0), icon: X, color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search order or tracking #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
        />
        <select value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Partners</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          {Object.entries(DELIVERY_STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
          <option value="NONE">No Tracking</option>
        </select>
      </div>

      {/* Shipments table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Order #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Partner</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">API</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tracking #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Delivery Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Location</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((s) => {
              const ds = s.deliveryTracking?.status
              const cfg = ds ? DELIVERY_STATUS_CONFIG[ds] : null
              return (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{s.orderNumber?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.user ? `${s.user.firstName} ${s.user.lastName}` : "-"}</td>
                  <td className="px-4 py-3">
                    {s.deliveryPartner ? (
                      <div className="flex items-center gap-2">
                        <Truck size={14} className="text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s.deliveryPartner.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">{s.carrier || "None"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.deliveryPartner?.apiEnabled ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        API
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{s.trackingNumber || "-"}</td>
                  <td className="px-4 py-3">
                    {cfg ? (
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">No tracking</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{s.deliveryTracking?.currentLocation || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {getTrackingUrl(s) && (
                        <a href={getTrackingUrl(s)!} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ExternalLink size={14} /></a>
                      )}
                      <button onClick={() => { setDetailOrder(s); setShowEventForm(false) }} className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20">View</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <PackageCheck size={40} className="mx-auto mb-3" />
            <p>No shipments found</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Shipment Details</h2>
              <button onClick={() => setDetailOrder(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Order #</p>
                  <p className="text-sm font-medium">{detailOrder.orderNumber?.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Partner</p>
                  <p className="text-sm font-medium">{detailOrder.deliveryPartner?.name || detailOrder.carrier || "None"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Tracking #</p>
                  <p className="text-sm font-mono">{detailOrder.trackingNumber || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Current Status</p>
                  {(() => {
                    const ds = detailOrder.deliveryTracking?.status
                    const cfg = ds ? DELIVERY_STATUS_CONFIG[ds] : null
                    return cfg ? (
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    ) : <span className="text-xs text-gray-400 dark:text-gray-500">No tracking</span>
                  })()}
                </div>
              </div>

              {getTrackingUrl(detailOrder) && (
                <a href={getTrackingUrl(detailOrder)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 w-fit">
                  <ExternalLink size={14} /> Track on {detailOrder.deliveryPartner?.name}
                </a>
              )}

              {/* Timeline */}
              {detailOrder.deliveryTracking?.events && detailOrder.deliveryTracking.events.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tracking Timeline</h3>
                  <div className="space-y-0">
                    {detailOrder.deliveryTracking.events.map((event, i) => {
                      const cfg = DELIVERY_STATUS_CONFIG[event.status]
                      const isLast = i === 0
                      return (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            {isLast ? <Circle size={16} className="text-primary-600 fill-primary-600" /> : <Circle size={16} className="text-gray-300 dark:text-gray-600" />}
                            {i < detailOrder.deliveryTracking!.events.length - 1 && <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700" />}
                          </div>
                          <div className="pb-4">
                            <p className={`text-sm font-medium ${isLast ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>{cfg?.label || event.status}</p>
                            {event.location && <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><MapPin size={10} />{event.location}</p>}
                            {event.notes && <p className="text-xs text-gray-400 dark:text-gray-500">{event.notes}</p>}
                            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><Clock size={10} />{new Date(event.occurredAt).toLocaleString()}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Create Shipment / Sync Tracking */}
              {detailOrder.deliveryPartner?.apiEnabled && !detailOrder.trackingNumber && (
                <button
                  onClick={createShipment}
                  disabled={createShipmentLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {createShipmentLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Create Shipment via {detailOrder.deliveryPartner.name}
                </button>
              )}
              {detailOrder.deliveryPartner?.apiEnabled && detailOrder.trackingNumber && (
                <button
                  onClick={syncTracking}
                  disabled={syncTrackingLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50"
                >
                  {syncTrackingLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Sync from {detailOrder.deliveryPartner.name}
                </button>
              )}

              {/* Add event */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                {showEventForm ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Tracking Event</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <select value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })} className="px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        {Object.entries(DELIVERY_STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                      </select>
                      <input type="text" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Current location" className="px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <input type="text" value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} placeholder="Notes" className="px-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowEventForm(false)} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
                      <button onClick={addTrackingEvent} disabled={addingEvent} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50">
                        {addingEvent ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Event
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowEventForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20">
                    <Plus size={14} /> Add Tracking Event
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}