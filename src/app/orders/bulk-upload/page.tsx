"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, FileText, Download, Zap, Trash2, ShoppingCart, Search, Package, Minus, Plus } from "lucide-react"
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

interface OrderItem {
  id: string
  product: ProductOption
  quantity: number | string // string while typing
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
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [quickShipping, setQuickShipping] = useState({ street: "", city: "", state: "", zip: "", country: "India" })
  const [quickNotes, setQuickNotes] = useState("")
  const [quickPlacing, setQuickPlacing] = useState(false)
  const [quickResult, setQuickResult] = useState<any>(null)

  // Autocomplete state
  const [searchResults, setSearchResults] = useState<ProductOption[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setHighlightedIndex(-1)
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

  // === Quick Order: Search & Add to Sidebar ===

  const doSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!query.trim()) {
      setSearchResults([])
      setDropdownOpen(false)
      setHighlightedIndex(-1)
      return
    }

    setSearchLoading(true)
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
        setSearchResults(products)
        setDropdownOpen(products.length > 0)
        setHighlightedIndex(-1)
      } catch (e) {
        console.error(e)
      }
      setSearchLoading(false)
    }, 300)
  }, [])

  const addToOrder = (product: ProductOption) => {
    // Check if already added
    const exists = orderItems.find((i) => i.product.id === product.id)
    if (exists) {
      // Increment quantity by MOQ
      const curQty = typeof exists.quantity === "number" ? exists.quantity : parseInt(exists.quantity) || 0
      updateOrderQty(exists.id, curQty + product.moq)
    } else {
      setOrderItems((prev) => [...prev, { id: crypto.randomUUID(), product, quantity: product.moq }])
    }
    // Reset search
    setSearchQuery("")
    setSearchResults([])
    setDropdownOpen(false)
    setHighlightedIndex(-1)
    // Keep focus on search input
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const removeFromOrder = (itemId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  const updateOrderQty = (itemId: string, qty: number | string) => {
    setOrderItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i))
    )
  }

  const commitOrderQty = (itemId: string) => {
    setOrderItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i
        const numQty = typeof i.quantity === "string" ? parseInt(i.quantity) || 0 : i.quantity
        if (numQty < i.product.moq) return { ...i, quantity: i.product.moq }
        return { ...i, quantity: numQty }
      })
    )
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || searchResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => {
        const next = Math.min(prev + 1, searchResults.length - 1)
        setTimeout(() => dropdownItemRefs.current.get(next)?.scrollIntoView({ block: "nearest" }), 0)
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => {
        const next = Math.max(prev - 1, 0)
        setTimeout(() => dropdownItemRefs.current.get(next)?.scrollIntoView({ block: "nearest" }), 0)
        return next
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        addToOrder(searchResults[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const handleQuickOrder = async () => {
    const validItems = orderItems.filter((i) => i.product.sku && ((typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 0) > 0))
    if (validItems.length === 0) {
      alert("Please add at least one product.")
      return
    }
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }

    // Check MOQ
    const moqErrors = validItems.filter((i) => (typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 0) < i.product.moq)
    if (moqErrors.length > 0) {
      alert(`Minimum order quantity not met for: ${moqErrors.map((i) => `${i.product.title} (MOQ: ${i.product.moq})`).join(", ")}`)
      return
    }

    setQuickPlacing(true)
    setQuickResult(null)

    try {
      const res = await fetch("/api/bulk-orders/quick-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: validItems.map((i) => ({ sku: i.product.sku, quantity: typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 1 })),
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

  const orderTotal = orderItems.reduce((sum, i) => {
    const qty = typeof i.quantity === "number" ? i.quantity : parseInt(i.quantity) || 0
    return sum + i.product.unitPrice * qty
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${mode === "quick" ? "max-w-5xl" : "max-w-3xl"}`}>
        <Link href="/orders/bulk-orders" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to Bulk Orders</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bulk Order</h1>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
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

          <div className={mode === "quick" ? "" : "p-6 space-y-5"}>
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
              <div className="flex flex-col lg:flex-row" ref={containerRef}>
                {/* LEFT: Search input */}
                <div className="flex-1 p-6 space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                    <p className="text-sm text-amber-800 font-medium flex items-center gap-1.5"><Zap size={14} /> Quick Order</p>
                    <p className="text-xs text-amber-700 mt-1">Type product name or SKU, use ↑↓ arrows to navigate, Enter to add. Products appear in the sidebar.</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Search Product</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Type product name or SKU..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          doSearch(e.target.value)
                        }}
                        onFocus={() => {
                          if (searchResults.length > 0 && searchQuery.trim()) {
                            setDropdownOpen(true)
                          }
                        }}
                        onKeyDown={handleSearchKeyDown}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {searchLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary-400 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>

                    {/* Dropdown */}
                    {dropdownOpen && searchResults.length > 0 && (
                      <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto relative z-30">
                        {searchResults.map((product, pidx) => {
                          const alreadyAdded = orderItems.some((i) => i.product.id === product.id)
                          return (
                            <button
                              key={product.id}
                              ref={(el) => { if (el) dropdownItemRefs.current.set(pidx, el) }}
                              onClick={() => addToOrder(product)}
                              className={`w-full text-left px-3 py-2.5 text-sm transition flex items-center gap-2.5 ${highlightedIndex === pidx ? "bg-primary-50 ring-1 ring-primary-200" : "hover:bg-primary-50"} ${alreadyAdded ? "opacity-50" : ""}`}
                            >
                              {product.thumbnail ? (
                                <img src={product.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                  <Package size={12} className="text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{product.title} {alreadyAdded && <span className="text-xs text-primary-500">(added)</span>}</p>
                                <p className="text-xs text-gray-500">SKU: {product.sku || "—"} · MOQ: {product.moq} · Stock: {product.inventoryQuantity}</p>
                              </div>
                              <span className="text-sm font-medium text-gray-700 shrink-0">{formatPrice(product.unitPrice)}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

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
                </div>

                {/* RIGHT: Order sidebar */}
                <div className="w-full lg:w-80 lg:border-l lg:border-gray-100 bg-gray-50 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart size={16} className="text-primary-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Your Order</h3>
                    <span className="ml-auto px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                      {orderItems.length} item{orderItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {orderItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Package size={28} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No products added yet</p>
                      <p className="text-xs text-gray-300 mt-1">Search & select products on the left</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4">
                        {orderItems.map((item) => {
                          const qty = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0
                          return (
                            <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-100">
                              <div className="flex items-start gap-2.5 mb-2">
                                {item.product.thumbnail ? (
                                  <img src={item.product.thumbnail} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                    <Package size={12} className="text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{item.product.title}</p>
                                  <p className="text-xs text-gray-500">SKU: {item.product.sku || "—"} · {formatPrice(item.product.unitPrice)}</p>
                                </div>
                                <button
                                  onClick={() => removeFromOrder(item.id)}
                                  className="p-1 text-gray-300 hover:text-red-500 transition shrink-0"
                                  title="Remove"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {/* Quantity controls */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const cur = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0
                                      const next = Math.max(item.product.moq, cur - item.product.moq)
                                      updateOrderQty(item.id, next)
                                    }}
                                    className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <input
                                    type="number"
                                    min={item.product.moq}
                                    value={item.quantity}
                                    onChange={(e) => updateOrderQty(item.id, e.target.value)}
                                    onBlur={() => commitOrderQty(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault()
                                        commitOrderQty(item.id)
                                        searchInputRef.current?.focus()
                                      }
                                    }}
                                    className="w-14 text-center text-sm border border-gray-200 rounded py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  />
                                  <button
                                    onClick={() => {
                                      const cur = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0
                                      updateOrderQty(item.id, cur + item.product.moq)
                                    }}
                                    className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <span className="text-sm font-semibold text-gray-900">{formatPrice(item.product.unitPrice * qty)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="border-t border-gray-200 pt-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-900">Total</span>
                          <span className="text-lg font-bold text-primary-700">{formatPrice(orderTotal)}</span>
                        </div>
                      </div>

                      <details className="mb-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-primary-600 transition">
                          Shipping Address (optional)
                        </summary>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          <input type="text" placeholder="Street" value={quickShipping.street} onChange={(e) => setQuickShipping({ ...quickShipping, street: e.target.value })} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                          <input type="text" placeholder="City" value={quickShipping.city} onChange={(e) => setQuickShipping({ ...quickShipping, city: e.target.value })} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                          <input type="text" placeholder="State" value={quickShipping.state} onChange={(e) => setQuickShipping({ ...quickShipping, state: e.target.value })} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                          <input type="text" placeholder="ZIP" value={quickShipping.zip} onChange={(e) => setQuickShipping({ ...quickShipping, zip: e.target.value })} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                        </div>
                      </details>

                      <input type="text" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs mb-3 bg-white" placeholder="Notes (optional)" />

                      <button
                        onClick={handleQuickOrder}
                        disabled={quickPlacing || orderItems.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 text-sm font-medium"
                      >
                        <ShoppingCart size={14} />
                        {quickPlacing ? "Placing..." : "Place Order"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}