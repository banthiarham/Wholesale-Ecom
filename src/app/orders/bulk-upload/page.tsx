"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, FileText, Download, Zap, Plus, Trash2, ShoppingCart, Search, X, Package } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import { formatPrice } from "@/lib/utils"

type TabMode = "excel" | "quick"

interface ProductOption {
  id: string
  title: string
  sku: string | null
  thumbnail: string | null
  unitPrice: number
  moq: number
  inventoryQuantity: number
}

interface QuickItem {
  id: string
  search: string
  selectedProduct: ProductOption | null
  quantity: number | string   // string while typing, number when committed
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
  const [quickItems, setQuickItems] = useState<QuickItem[]>([{ id: crypto.randomUUID(), search: "", selectedProduct: null, quantity: 1 }])
  const [quickShipping, setQuickShipping] = useState({ street: "", city: "", state: "", zip: "", country: "India" })
  const [quickNotes, setQuickNotes] = useState("")
  const [quickPlacing, setQuickPlacing] = useState(false)
  const [quickResult, setQuickResult] = useState<any>(null)

  // Autocomplete state
  const [searchResults, setSearchResults] = useState<Map<string, ProductOption[]>>(new Map())
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [searchLoading, setSearchLoading] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rowInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  // === Quick Order Autocomplete ===

  const searchProducts = useCallback((itemId: string, query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!query.trim()) {
      setSearchResults((prev) => { const m = new Map(prev); m.delete(itemId); return m })
      setActiveDropdown(null)
      return
    }

    setSearchLoading(itemId)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=8&in_stock=true`)
        const data = await res.json()
        const products: ProductOption[] = (data.products || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          sku: p.sku,
          thumbnail: p.thumbnail,
          unitPrice: Number(p.unitPrice),
          moq: p.moq,
          inventoryQuantity: p.inventoryQuantity,
        }))
        setSearchResults((prev) => { const m = new Map(prev); m.set(itemId, products); return m })
        setActiveDropdown(itemId)
      } catch (e) {
        console.error(e)
      }
      setSearchLoading((prev) => prev === itemId ? null : prev)
    }, 300)
  }, [])

  const addQuickItem = () => {
    const newItem: QuickItem = { id: crypto.randomUUID(), search: "", selectedProduct: null, quantity: 1 }
    setQuickItems((prev) => [...prev, newItem])
    // Focus the new row's search input after render
    setTimeout(() => {
      rowInputRefs.current.get(newItem.id)?.focus()
    }, 50)
  }

  const removeQuickItem = (id: string) => {
    if (quickItems.length <= 1) return
    setQuickItems(quickItems.filter((i) => i.id !== id))
    setSearchResults((prev) => { const m = new Map(prev); m.delete(id); return m })
    if (activeDropdown === id) setActiveDropdown(null)
  }

  const selectProduct = (itemId: string, product: ProductOption) => {
    setQuickItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, search: `${product.title} (SKU: ${product.sku || "—"})`, selectedProduct: product, quantity: Math.max(i.quantity, product.moq) }
          : i
      )
    )
    setActiveDropdown(null)
  }

  const clearProductSelection = (itemId: string) => {
    setQuickItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, search: "", selectedProduct: null, quantity: "" } : i
      )
    )
  }

  const updateQuickItem = (itemId: string, field: "search" | "quantity", value: string | number) => {
    setQuickItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i
        if (field === "search") {
          return { ...i, search: value as string, selectedProduct: null }
        }
        // Allow empty string while typing, otherwise parse to number
        if (value === "" || value === 0) return { ...i, quantity: value }
        return { ...i, quantity: parseInt(String(value)) || 1 }
      })
    )
  }

  const handleQuantityBlur = (itemId: string) => {
    setQuickItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i
        const numQty = typeof i.quantity === "string" ? parseInt(i.quantity) || 0 : i.quantity
        const minQty = i.selectedProduct?.moq || 1
        if (numQty < minQty) return { ...i, quantity: minQty }
        return { ...i, quantity: numQty }
      })
    )
  }

  const handleSearchKeyDown = (itemId: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const item = quickItems.find((i) => i.id === itemId)
      if (item?.selectedProduct) {
        addQuickItem()
      }
    }
  }

  const handleQuantityKeyDown = (itemId: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const item = quickItems.find((i) => i.id === itemId)
      if (item?.selectedProduct) {
        // Enforce MOQ on Enter before adding new row
        const numQty = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0
        const minQty = item.selectedProduct.moq || 1
        if (numQty < minQty) {
          setQuickItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: minQty } : i))
        }
        addQuickItem()
      }
    }
  }

  const handleQuickOrder = async () => {
    const validItems = quickItems.filter((i) => i.selectedProduct && i.selectedProduct.sku && (typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 0) > 0)
    if (validItems.length === 0) {
      alert("Please select at least one product with quantity.")
      return
    }
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    // Check MOQ
    const moqErrors = validItems.filter((i) => (typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 0) < (i.selectedProduct?.moq || 1))
    if (moqErrors.length > 0) {
      alert(`Minimum order quantity not met for: ${moqErrors.map((i) => `${i.selectedProduct!.title} (MOQ: ${i.selectedProduct!.moq})`).join(", ")}`)
      return
    }

    setQuickPlacing(true)
    setQuickResult(null)

    try {
      const res = await fetch("/api/bulk-orders/quick-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: validItems.map((i) => ({ sku: i.selectedProduct!.sku, quantity: typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 1 })),
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
                  <p className="text-xs text-amber-700 mt-1">Type product name or SKU to search. Select a product, set quantity, and press Enter to add another row. Order is placed immediately.</p>
                </div>

                <div ref={containerRef}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Items</label>
                    <button onClick={addQuickItem} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      <Plus size={14} /> Add Row
                    </button>
                  </div>

                  <div className="space-y-2">
                    {quickItems.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 w-6 text-center pt-3">{idx + 1}</span>

                        {/* Search / Selected product input */}
                        <div className="flex-1 relative">
                          {item.selectedProduct ? (
                            // Selected state — show product info with clear button
                            <div className="flex items-center gap-2 px-3 py-2.5 border border-primary-200 bg-primary-50 rounded-lg">
                              {item.selectedProduct.thumbnail ? (
                                <img src={item.selectedProduct.thumbnail} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-primary-100 flex items-center justify-center shrink-0">
                                  <Package size={12} className="text-primary-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{item.selectedProduct.title}</p>
                                <p className="text-xs text-gray-500">SKU: {item.selectedProduct.sku || "—"} · {formatPrice(item.selectedProduct.unitPrice)} · MOQ: {item.selectedProduct.moq}</p>
                              </div>
                              <button
                                onClick={() => clearProductSelection(item.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition shrink-0"
                                title="Remove product"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            // Search state — input with autocomplete dropdown
                            <>
                              <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                  ref={(el) => { if (el) rowInputRefs.current.set(item.id, el) }}
                                  type="text"
                                  placeholder="Type product name or SKU..."
                                  value={item.search}
                                  onChange={(e) => {
                                    updateQuickItem(item.id, "search", e.target.value)
                                    searchProducts(item.id, e.target.value)
                                  }}
                                  onFocus={() => {
                                    if (searchResults.has(item.id) && searchResults.get(item.id)!.length > 0) {
                                      setActiveDropdown(item.id)
                                    }
                                  }}
                                  onKeyDown={(e) => handleSearchKeyDown(item.id, e)}
                                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                {searchLoading === item.id && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin h-4 w-4 border-2 border-primary-400 border-t-transparent rounded-full"></div>
                                  </div>
                                )}
                              </div>

                              {/* Dropdown */}
                              {activeDropdown === item.id && searchResults.has(item.id) && (
                                <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                  {searchResults.get(item.id)!.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
                                  ) : (
                                    searchResults.get(item.id)!.map((product) => (
                                      <button
                                        key={product.id}
                                        onClick={() => selectProduct(item.id, product)}
                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary-50 transition flex items-center gap-2.5"
                                      >
                                        {product.thumbnail ? (
                                          <img src={product.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                        ) : (
                                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                            <Package size={12} className="text-gray-400" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-900 truncate">{product.title}</p>
                                          <p className="text-xs text-gray-500">SKU: {product.sku || "—"} · MOQ: {product.moq} · Stock: {product.inventoryQuantity}</p>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 shrink-0">{formatPrice(product.unitPrice)}</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Quantity */}
                        <input
                          type="number"
                          min={item.selectedProduct?.moq || 1}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateQuickItem(item.id, "quantity", e.target.value)}
                          onBlur={() => handleQuantityBlur(item.id)}
                          onKeyDown={(e) => handleQuantityKeyDown(item.id, e)}
                          className="w-24 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />

                        {/* Remove row */}
                        <button
                          onClick={() => removeQuickItem(item.id)}
                          disabled={quickItems.length <= 1}
                          className="p-2.5 text-gray-300 hover:text-red-500 disabled:opacity-30 transition mt-0.5"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order summary of selected items */}
                {quickItems.some((i) => i.selectedProduct) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Order Summary</p>
                    <div className="space-y-1">
                      {quickItems.filter((i) => i.selectedProduct).map((item) => {
                        const qty = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0
                        return (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{item.selectedProduct!.title} × {qty}</span>
                            <span className="font-medium text-gray-900">{formatPrice(item.selectedProduct!.unitPrice * qty)}</span>
                          </div>
                        )
                      })}
                      <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-primary-700">
                          {formatPrice(quickItems.filter((i) => i.selectedProduct).reduce((sum, i) => {
                            const qty = typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 0
                            return sum + i.selectedProduct!.unitPrice * qty
                          }, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

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
                  disabled={quickPlacing || !quickItems.some((i) => i.selectedProduct)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-medium"
                >
                  <ShoppingCart size={16} />
                  {quickPlacing ? "Placing Order..." : "Place Order"}
                </button>

                {quickResult && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-100">
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