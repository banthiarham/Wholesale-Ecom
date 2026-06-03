"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShoppingCart, XCircle, CheckCircle, AlertTriangle, Package, Trash2 } from "lucide-react"

interface BulkOrderItem {
  id: string
  productId: string
  sku: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  notes: string | null
  product: {
    id: string
    title: string
    thumbnail: string | null
    sku: string | null
    moq: number
    unitPrice: number
    inventoryQuantity: number
    reservedQuantity: number
    manageInventory: boolean
    allowBackorder: boolean
  }
}

interface BulkOrder {
  id: string
  bulkOrderNumber: string
  status: string
  totalAmount: number
  shippingAddress: any
  notes: string | null
  createdAt: string
  items: BulkOrderItem[]
  order?: { id: string; orderNumber: string; status: string } | null
}

export default function BulkOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [bulkOrder, setBulkOrder] = useState<BulkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const debounceRefs = useRef<Record<string, NodeJS.Timeout>>({})

  // Local optimistic state for items
  const [localItems, setLocalItems] = useState<BulkOrderItem[]>([])

  const loadBulkOrder = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    try {
      const res = await fetch(`/api/bulk-orders/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message || "Failed to load bulk order")
        setLoading(false)
        return
      }
      const data = await res.json()
      setBulkOrder(data.bulkOrder)
      setLocalItems(data.bulkOrder.items || [])
    } catch (e) {
      setError("Failed to load bulk order")
    }
    setLoading(false)
  }, [params.id, router])

  useEffect(() => { loadBulkOrder() }, [loadBulkOrder])

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const item = localItems.find((i) => i.id === itemId)
    if (!item) return

    // Optimistic update
    const moq = item.product.moq
    const clampedQty = Math.max(moq, newQuantity)
    const newTotal = Number(item.unitPrice) * clampedQty

    setLocalItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, quantity: clampedQty, totalPrice: newTotal } : i
      )
    )

    // Clear previous error for this item
    setItemErrors((prev) => {
      const copy = { ...prev }
      delete copy[itemId]
      return copy
    })

    // Debounced API call
    if (debounceRefs.current[itemId]) {
      clearTimeout(debounceRefs.current[itemId])
    }

    debounceRefs.current[itemId] = setTimeout(async () => {
      const token = localStorage.getItem("token")
      try {
        const res = await fetch(`/api/bulk-orders/${params.id}/items/${itemId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ quantity: clampedQty }),
        })
        const data = await res.json()

        if (!res.ok) {
          setItemErrors((prev) => ({ ...prev, [itemId]: data.message || "Update failed" }))
          // Revert: reload from server
          loadBulkOrder()
          return
        }

        // Update local with server response (pricing may have changed with new qty)
        if (data.item) {
          setLocalItems((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    quantity: data.item.quantity,
                    unitPrice: data.item.unitPrice,
                    totalPrice: data.item.totalPrice,
                  }
                : i
            )
          )
        }

        // Update total amount from server (refetch is cleaner but we can approximate)
        loadBulkOrder()
      } catch (e) {
        setItemErrors((prev) => ({ ...prev, [itemId]: "Failed to update quantity" }))
      }
    }, 600)
  }

  const handlePlaceOrder = async () => {
    if (!bulkOrder) return
    const confirmed = window.confirm("Are you sure you want to place this bulk order? This will create a real order and reserve inventory.")
    if (!confirmed) return

    setPlacing(true)
    const token = localStorage.getItem("token")
    try {
      const res = await fetch(`/api/bulk-orders/${bulkOrder.id}/place`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (res.ok && data.order) {
        router.push(`/orders/${data.order.id}`)
      } else {
        setError(data.message || "Failed to place order")
      }
    } catch (e) {
      setError("Failed to place order. Please try again.")
    }
    setPlacing(false)
  }

  const handleCancelDraft = async () => {
    if (!bulkOrder) return
    const confirmed = window.confirm("Are you sure you want to cancel this bulk order draft?")
    if (!confirmed) return

    setCancelling(true)
    const token = localStorage.getItem("token")
    try {
      const res = await fetch(`/api/bulk-orders/${bulkOrder.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        router.push("/orders/bulk-orders")
      } else {
        const data = await res.json()
        setError(data.message || "Failed to cancel")
      }
    } catch (e) {
      setError("Failed to cancel. Please try again.")
    }
    setCancelling(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT": return "bg-yellow-100 text-yellow-700"
      case "PLACED": return "bg-green-100 text-green-700"
      case "CANCELLED": return "bg-red-100 text-red-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "DRAFT": return "Draft"
      case "PLACED": return "Placed"
      case "CANCELLED": return "Cancelled"
      default: return status
    }
  }

  const totalAmount = localItems.reduce((sum, i) => sum + Number(i.totalPrice), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error && !bulkOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 mb-4">{error}</p>
          <Link href="/orders/bulk-orders" className="text-primary-600 hover:underline">← Back to Bulk Orders</Link>
        </div>
      </div>
    )
  }

  if (!bulkOrder) return null

  const isDraft = bulkOrder.status === "DRAFT"
  const isPlaced = bulkOrder.status === "PLACED"
  const isCancelled = bulkOrder.status === "CANCELLED"

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/orders/bulk-orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to Bulk Orders</Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{bulkOrder.bulkOrderNumber}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(bulkOrder.status)}`}>
                {getStatusLabel(bulkOrder.status)}
              </span>
            </div>
            <p className="text-sm text-gray-500">Created on {new Date(bulkOrder.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            {isPlaced && bulkOrder.order && (
              <Link href={`/orders/${bulkOrder.order.id}`} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline mt-1">
                <CheckCircle size={14} /> View Order {bulkOrder.order.orderNumber.slice(0, 8)} →
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><XCircle size={16} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items Table - Main area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package size={18} /> Items ({localItems.length})
                </h2>
              </div>

              {localItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No items in this bulk order</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Quantity</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {localItems.map((item) => (
                        <tr key={item.id} className={`hover:bg-gray-50 transition ${itemErrors[item.id] ? "bg-red-50/50" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.product.thumbnail ? (
                                <img src={item.product.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                                  <Package size={16} className="text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{item.product.title}</p>
                                {item.product.moq > 1 && (
                                  <p className="text-xs text-gray-500">MOQ: {item.product.moq}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{item.sku || item.product.sku || "—"}</td>
                          <td className="px-4 py-3 text-right text-gray-900">₹{Number(item.unitPrice).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-center">
                            {isDraft ? (
                              <div>
                                <input
                                  type="number"
                                  min={item.product.moq}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value)
                                    if (!isNaN(val) && val > 0) {
                                      handleQuantityChange(item.id, val)
                                    }
                                  }}
                                  className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                                {itemErrors[item.id] && (
                                  <p className="text-xs text-red-500 mt-1 max-w-[120px]">{itemErrors[item.id]}</p>
                                )}
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900">{item.quantity}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            ₹{Number(item.totalPrice).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">
                          ₹{totalAmount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Items</span>
                  <span className="font-medium text-gray-900">{localItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Quantity</span>
                  <span className="font-medium text-gray-900">{localItems.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Amount</span>
                  <span className="font-bold text-gray-900">₹{totalAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h3>
              {bulkOrder.shippingAddress && typeof bulkOrder.shippingAddress === "object" ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{bulkOrder.shippingAddress.street}</p>
                  <p>{bulkOrder.shippingAddress.city}, {bulkOrder.shippingAddress.state} {bulkOrder.shippingAddress.zip}</p>
                  <p>{bulkOrder.shippingAddress.country || "India"}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No shipping address provided</p>
              )}
            </div>

            {/* Notes */}
            {bulkOrder.notes && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600">{bulkOrder.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            {isDraft && (
              <div className="space-y-2">
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || localItems.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 text-sm font-medium"
                >
                  <ShoppingCart size={16} />
                  {placing ? "Placing Order..." : "Place Order"}
                </button>
                <button
                  onClick={handleCancelDraft}
                  disabled={cancelling}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50 text-sm"
                >
                  <Trash2 size={14} />
                  {cancelling ? "Cancelling..." : "Cancel Draft"}
                </button>
              </div>
            )}

            {isPlaced && bulkOrder.order && (
              <Link
                href={`/orders/${bulkOrder.order.id}`}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
              >
                <ShoppingCart size={16} />
                View Order
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}