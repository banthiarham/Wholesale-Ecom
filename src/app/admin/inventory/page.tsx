"use client"

import { useEffect, useState } from "react"
import { Search, ArrowUpDown, Package, AlertTriangle } from "lucide-react"

interface InventoryItem {
  id: string
  sku: string | null
  title: string
  inventoryQuantity: number
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
      result = result.filter((i) => i.inventoryQuantity <= i.moq)
    }
    setFiltered(result)
  }, [items, search, lowStockOnly])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const prods = (data.products || []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        inventoryQuantity: p.inventoryQuantity,
        moq: p.moq,
        status: p.status,
        vendorName: p.vendorName,
      }))
      setItems(prods)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const adjustStock = async (id: string, delta: number) => {
    try {
      await fetch(`/api/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: delta }),
      })
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, inventoryQuantity: Math.max(0, i.inventoryQuantity + delta) } : i))
      )
    } catch (err) {
      console.error(err)
      alert("Failed to adjust stock")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Low stock only</span>
          </label>
        </div>
        <span className="text-sm text-gray-500">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">MOQ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.inventoryQuantity <= item.moq && (
                          <AlertTriangle size={14} className="text-red-500" title="Low stock" />
                        )}
                        <span className="font-medium text-gray-900">{item.title}</span>
                      </div>
                      {item.vendorName && <p className="text-xs text-gray-500">{item.vendorName}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.sku || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{item.moq}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${item.inventoryQuantity <= item.moq ? "text-red-600" : "text-green-600"}`}>
                        {item.inventoryQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                        item.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => adjustStock(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50 text-sm"
                        >
                          −
                        </button>
                        <button
                          onClick={() => adjustStock(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50 text-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => {
                            const qty = prompt(`Enter quantity to add (negative to subtract):`)
                            if (qty) adjustStock(item.id, Number(qty))
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"
                          title="Custom adjust"
                        >
                          <ArrowUpDown size={14} />
                        </button>
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
