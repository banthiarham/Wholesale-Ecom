"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, History } from "lucide-react"

interface InventoryItem {
  id: string
  title: string
  sku: string | null
  inventoryQuantity: number
  reservedQuantity: number
  moq: number
  status: string
}

export default function VendorInventoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(false)
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
  }, [router])

  const handleAdjust = async () => {
    if (!selected || !adjustment || !reason) return
    const token = localStorage.getItem("token")
    setAdjusting(true)
    const res = await fetch(`/api/inventory/${selected.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adjustment: Number(adjustment), reason }),
    })
    if (res.ok) {
      setSelected(null)
      setAdjustment("")
      setReason("")
      window.location.reload()
    } else {
      setAdjusting(false)
      alert("Failed to adjust stock")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-4"><ArrowLeft size={16} /> Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventory Management</h1>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Available</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Reserved</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
              </tr></thead>
              <tbody>
                {items.map((item) => {
                  const available = item.inventoryQuantity - item.reservedQuantity
                  const low = available <= 10
                  return (
                    <tr key={item.id} className={`border-b hover:bg-gray-50 ${low ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3 font-medium">
                        {item.title}
                        {low && <AlertTriangle size={14} className="inline text-red-500 ml-1" />}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.sku || "-"}</td>
                      <td className={`px-4 py-3 font-medium ${low ? "text-red-600" : ""}`}>{available}</td>
                      <td className="px-4 py-3 text-gray-600">{item.reservedQuantity}</td>
                      <td className="px-4 py-3">{item.inventoryQuantity}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(item)} className="text-sm text-primary-600 hover:underline">Adjust</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="font-semibold mb-4">Adjust Stock: {selected.title}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Adjustment (+/- quantity)</label>
                  <input type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="e.g., 50 or -20" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Reason</label>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="e.g., New stock arrival, Damaged goods" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setSelected(null)} className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleAdjust} disabled={adjusting || !adjustment || !reason} className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                  {adjusting ? "Adjusting..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
