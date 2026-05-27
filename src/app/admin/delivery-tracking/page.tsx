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
} from "lucide-react"

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "text-yellow-700", bg: "bg-yellow-50" },
  PICKED_UP: { label: "Picked Up", color: "text-blue-700", bg: "bg-blue-50" },
  IN_TRANSIT: { label: "In Transit", color: "text-indigo-700", bg: "bg-indigo-50" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-orange-700", bg: "bg-orange-50" },
  DELIVERED: { label: "Delivered", color: "text-green-700", bg: "bg-green-50" },
  FAILED: { label: "Failed", color: "text-red-700", bg: "bg-red-50" },
  RETURNED: { label: "Returned", color: "text-gray-700", bg: "bg-gray-100" },
}

interface ShipmentOrder {
  id: string
  orderNumber: string
  trackingNumber: string | null
  carrier: string | null
  status: string
  createdAt: string
  user?: { firstName: string; lastName: string; email: string }
  deliveryPartner?: { id: string; name: string; code: string; trackingUrlTemplate: string | null; logo: string | null } | null
  deliveryTracking?: { status: string; currentLocation: string | null; estimatedDelivery: string | null; events: { id: string; status: string; location: string | null; notes: string | null; occurredAt: string }[] } | null
}

interface Partner {
  id: string
  name: string
  code: string
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
    }).catch(() => {}).finally(() => setLoading(false))
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipment Tracking</h1>
        <p className="text-sm text-gray-500">Monitor all deliveries and tracking updates</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Shipments", value: stats?.totalShipments ?? shipments.length, icon: PackageCheck, color: "bg-blue-50 text-blue-600" },
          { label: "In Transit", value: stats?.byStatus?.IN_TRANSIT ?? 0, icon: Truck, color: "bg-indigo-50 text-indigo-600" },
          { label: "Delivered", value: stats?.byStatus?.DELIVERED ?? 0, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
          { label: "Failed", value: (stats?.byStatus?.FAILED ?? 0) + (stats?.byStatus?.RETURNED ?? 0), icon: X, color: "bg-red-50 text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
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
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
        />
        <select value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Partners</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          {Object.entries(DELIVERY_STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
          <option value="NONE">No Tracking</option>
        </select>
      </div>

      {/* Shipments table */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Partner</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tracking #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Delivery Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((s) => {
              const ds = s.deliveryTracking?.status
              const cfg = ds ? DELIVERY_STATUS_CONFIG[ds] : null
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.orderNumber?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.user ? `${s.user.firstName} ${s.user.lastName}` : "-"}</td>
                  <td className="px-4 py-3">
                    {s.deliveryPartner ? (
                      <div className="flex items-center gap-2">
                        <Truck size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-700">{s.deliveryPartner.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">{s.carrier || "None"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{s.trackingNumber || "-"}</td>
                  <td className="px-4 py-3">
                    {cfg ? (
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    ) : (
                      <span className="text-xs text-gray-400">No tracking</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.deliveryTracking?.currentLocation || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {getTrackingUrl(s) && (
                        <a href={getTrackingUrl(s)!} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"><ExternalLink size={14} /></a>
                      )}
                      <button onClick={() => { setDetailOrder(s); setShowEventForm(false) }} className="px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">View</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <PackageCheck size={40} className="mx-auto mb-3" />
            <p>No shipments found</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Shipment Details</h2>
              <button onClick={() => setDetailOrder(null)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Order #</p>
                  <p className="text-sm font-medium">{detailOrder.orderNumber?.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Partner</p>
                  <p className="text-sm font-medium">{detailOrder.deliveryPartner?.name || detailOrder.carrier || "None"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tracking #</p>
                  <p className="text-sm font-mono">{detailOrder.trackingNumber || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Current Status</p>
                  {(() => {
                    const ds = detailOrder.deliveryTracking?.status
                    const cfg = ds ? DELIVERY_STATUS_CONFIG[ds] : null
                    return cfg ? (
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    ) : <span className="text-xs text-gray-400">No tracking</span>
                  })()}
                </div>
              </div>

              {getTrackingUrl(detailOrder) && (
                <a href={getTrackingUrl(detailOrder)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 w-fit">
                  <ExternalLink size={14} /> Track on {detailOrder.deliveryPartner?.name}
                </a>
              )}

              {/* Timeline */}
              {detailOrder.deliveryTracking?.events && detailOrder.deliveryTracking.events.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tracking Timeline</h3>
                  <div className="space-y-0">
                    {detailOrder.deliveryTracking.events.map((event, i) => {
                      const cfg = DELIVERY_STATUS_CONFIG[event.status]
                      const isLast = i === 0
                      return (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            {isLast ? <Circle size={16} className="text-primary-600 fill-primary-600" /> : <Circle size={16} className="text-gray-300" />}
                            {i < detailOrder.deliveryTracking!.events.length - 1 && <div className="w-0.5 h-8 bg-gray-200" />}
                          </div>
                          <div className="pb-4">
                            <p className={`text-sm font-medium ${isLast ? "text-gray-900" : "text-gray-500"}`}>{cfg?.label || event.status}</p>
                            {event.location && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{event.location}</p>}
                            {event.notes && <p className="text-xs text-gray-400">{event.notes}</p>}
                            <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{new Date(event.occurredAt).toLocaleString()}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Add event */}
              <div className="border-t border-gray-100 pt-4">
                {showEventForm ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Add Tracking Event</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <select value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })} className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        {Object.entries(DELIVERY_STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                      </select>
                      <input type="text" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Current location" className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <input type="text" value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} placeholder="Notes" className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowEventForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                      <button onClick={addTrackingEvent} disabled={addingEvent} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50">
                        {addingEvent ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Event
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowEventForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
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