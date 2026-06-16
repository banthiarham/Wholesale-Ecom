"use client"

import { useEffect, useState } from "react"
import { Search, AlertTriangle, X } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface InventoryItem {
  id: string
  sku: string | null
  title: string
  inventoryQuantity: number
  reservedQuantity: number
  moq: number
  status: string
  vendorName: string | null
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filtered, setFiltered] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    loadInventory()
  }, [token])

  useEffect(() => {
    let result = [...items]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.title.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
    }
    if (lowStockOnly) {
      result = result.filter((i) => (i.inventoryQuantity - i.reservedQuantity) <= 10)
    }
    setFiltered(result)
  }, [items, search, lowStockOnly])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.items || data.inventory || []
      setItems(list.map((item: any) => ({
        id: item.id || item.productId,
        sku: item.sku || null,
        title: item.title || item.product?.title || "",
        inventoryQuantity: item.inventoryQuantity ?? item.totalQuantity ?? 0,
        reservedQuantity: item.reservedQuantity ?? 0,
        moq: item.moq ?? 0,
        status: item.status || "ACTIVE",
        vendorName: item.vendorName || item.product?.vendorName || null,
      })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const adjustStock = async () => {
    if (!selected || !adjustment || !reason) return
    setAdjusting(true)
    try {
      const res = await fetch(`/api/inventory/${selected.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adjustment: Number(adjustment), reason }),
      })
      if (res.ok) {
        setSelected(null)
        setAdjustment("")
        setReason("")
        loadInventory()
      } else {
        alert("Failed to adjust stock")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to adjust stock")
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Low stock only (≤10 available)</span>
          </label>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Available</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reserved</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">MOQ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((item) => {
                  const available = item.inventoryQuantity - item.reservedQuantity
                  const isLow = available <= 10
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${isLow ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                        </div>
                        {item.vendorName && <p className="text-xs text-gray-500 dark:text-gray-400">{item.vendorName}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.sku || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isLow ? "text-red-600" : "text-green-600"}`}>
                          {available}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.reservedQuantity}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{item.inventoryQuantity}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.moq}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.status === "PUBLISHED" || item.status === "ACTIVE" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          item.status === "DRAFT" ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelected(item); setAdjustment(""); setReason("") }}
                          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-gray-700 dark:text-gray-300"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adjust Stock: {selected.title}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current stock:</span>
                  <span className="font-medium dark:text-gray-100">{selected.inventoryQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Reserved:</span>
                  <span className="font-medium dark:text-gray-100">{selected.reservedQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Available:</span>
                  <span className="font-medium dark:text-gray-100">{selected.inventoryQuantity - selected.reservedQuantity}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjustment (+/- quantity)</label>
                <input
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  placeholder="e.g. +50 or -20"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. New stock arrival, Damaged goods"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-sm font-medium dark:text-gray-200">Cancel</button>
                <button onClick={adjustStock} disabled={adjusting || !adjustment || !reason} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
                  {adjusting ? "Adjusting..." : "Save Adjustment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}