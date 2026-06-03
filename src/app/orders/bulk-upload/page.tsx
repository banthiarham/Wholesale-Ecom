"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, FileText, Download, Zap, Plus, Trash2, ShoppingCart } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

type TabMode = "excel" | "quick"

interface QuickItem {
  id: string
  sku: string
  quantity: number
}

export default function BulkUploadPage() {
  const router = useRouter()
  const [mode, setMode] = useState<TabMode>("excel")

  // Excel upload state
  const [file, setFile] = useState<File | null>(null)
  const [shippingAddress, setShippingAddress] = useState({ street: "", city: "", state: "", zip: "", country: "India" })
  const [notes, setNotes] = useState("")
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Quick order state
  const [quickItems, setQuickItems] = useState<QuickItem[]>([{ id: crypto.randomUUID(), sku: "", quantity: 1 }])
  const [quickShipping, setQuickShipping] = useState({ street: "", city: "", state: "", zip: "", country: "India" })
  const [quickNotes, setQuickNotes] = useState("")
  const [quickPlacing, setQuickPlacing] = useState(false)
  const [quickResult, setQuickResult] = useState<any>(null)

  const downloadExcelTemplate = () => {
    const headers = ["sku", "quantity", "notes"]
    const exampleRow = ["WEP-001", 50, "Urgent delivery needed"]
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
    ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Order")
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    saveAs(blob, "bulk_order_template.xlsx")
  }

  const handleExcelUpload = async () => {
    if (!file) return
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    setUploading(true)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("shippingAddress", JSON.stringify(shippingAddress))
    formData.append("notes", notes)

    try {
      const res = await fetch("/api/bulk-orders/upload-excel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()

      if (res.ok && data.bulkOrder) {
        router.push(`/orders/bulk-orders/${data.bulkOrder.id}`)
      } else {
        setResult(data)
      }
    } catch (e) {
      setResult({ message: "Failed to upload file. Please try again." })
    }
    setUploading(false)
  }

  // Quick Order handlers
  const addQuickItem = () => {
    setQuickItems([...quickItems, { id: crypto.randomUUID(), sku: "", quantity: 1 }])
  }

  const removeQuickItem = (id: string) => {
    if (quickItems.length <= 1) return
    setQuickItems(quickItems.filter((i) => i.id !== id))
  }

  const updateQuickItem = (id: string, field: "sku" | "quantity", value: string | number) => {
    setQuickItems(quickItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const handleQuickOrder = async () => {
    const validItems = quickItems.filter((i) => i.sku.trim() && i.quantity > 0)
    if (validItems.length === 0) {
      alert("Please enter at least one SKU with quantity.")
      return
    }
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    setQuickPlacing(true)
    setQuickResult(null)

    try {
      const res = await fetch("/api/bulk-orders/quick-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: validItems.map((i) => ({ sku: i.sku.trim(), quantity: i.quantity })),
          shippingAddress: quickShipping.street ? quickShipping : undefined,
          notes: quickNotes || undefined,
        }),
      })
      const data = await res.json()

      if (res.ok && data.order) {
        router.push(`/orders/${data.order.id}`)
      } else {
        setQuickResult(data)
      }
    } catch (e) {
      setQuickResult({ message: "Failed to place order. Please try again." })
    }
    setQuickPlacing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/orders/bulk-orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to Bulk Orders</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bulk Order</h1>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Mode Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => { setMode("excel"); setResult(null); setQuickResult(null) }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${mode === "excel" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <FileText size={14} className="inline mr-1.5" /> Excel Upload
            </button>
            <button
              onClick={() => { setMode("quick"); setResult(null); setQuickResult(null) }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${mode === "quick" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Zap size={14} className="inline mr-1.5" /> Quick Order
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* ========== EXCEL UPLOAD TAB ========== */}
            {mode === "excel" && (
              <>
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-medium mb-1">Excel Format (.xlsx)</p>
                  <p className="text-xs text-green-700">Columns: sku, quantity, notes (optional). Upload creates a draft — you can review & edit before placing the order.</p>
                  <button onClick={downloadExcelTemplate} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition">
                    <Download size={14} /> Download Template
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" placeholder="Street" value={shippingAddress.street} onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" placeholder="City" value={shippingAddress.city} onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" placeholder="State" value={shippingAddress.state} onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" placeholder="ZIP" value={shippingAddress.zip} onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Order notes" />
                </div>

                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload size={32} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">{file ? file.name : "Click to select Excel file (.xlsx)"}</p>
                  </label>
                </div>

                <button
                  onClick={handleExcelUpload}
                  disabled={uploading || !file || !shippingAddress.street || !shippingAddress.city}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium"
                >
                  <FileText size={16} />
                  {uploading ? "Uploading..." : "Upload & Review Order"}
                </button>

                {result && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                    {result.message && <p className="text-sm text-red-700 font-medium">{result.message}</p>}
                    {result.errors && (
                      <ul className="text-sm text-red-700 list-disc list-inside">
                        {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ========== QUICK ORDER TAB ========== */}
            {mode === "quick" && (
              <>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                  <p className="text-sm text-amber-800 font-medium flex items-center gap-1.5"><Zap size={14} /> Quick Order</p>
                  <p className="text-xs text-amber-700 mt-1">Type SKU and quantity to place an order instantly. No draft — order is placed immediately.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Items</label>
                    <button onClick={addQuickItem} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                  <div className="space-y-2">
                    {quickItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-6 text-center">{idx + 1}</span>
                        <input
                          type="text"
                          placeholder="SKU (e.g. SLP-004)"
                          value={item.sku}
                          onChange={(e) => updateQuickItem(item.id, "sku", e.target.value)}
                          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateQuickItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                          className="w-24 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={() => removeQuickItem(item.id)}
                          disabled={quickItems.length <= 1}
                          className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <details className="group">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-primary-600 transition">
                    Shipping Address (optional)
                  </summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" placeholder="Street" value={quickShipping.street} onChange={(e) => setQuickShipping({ ...quickShipping, street: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" placeholder="City" value={quickShipping.city} onChange={(e) => setQuickShipping({ ...quickShipping, city: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" placeholder="State" value={quickShipping.state} onChange={(e) => setQuickShipping({ ...quickShipping, state: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" placeholder="ZIP" value={quickShipping.zip} onChange={(e) => setQuickShipping({ ...quickShipping, zip: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </details>

                <div>
                  <input type="text" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Notes (optional)" />
                </div>

                <button
                  onClick={handleQuickOrder}
                  disabled={quickPlacing || quickItems.every((i) => !i.sku.trim())}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium"
                >
                  <ShoppingCart size={16} />
                  {quickPlacing ? "Placing Order..." : "Place Order"}
                </button>

                {quickResult && (
                  <div className={`p-4 rounded-lg ${quickResult.order ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                    {quickResult.message && <p className="text-sm text-red-700 font-medium">{quickResult.message}</p>}
                    {quickResult.errors && (
                      <ul className="text-sm text-yellow-700 list-disc list-inside">
                        {quickResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}