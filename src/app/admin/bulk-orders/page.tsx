"use client"

import { useEffect, useState } from "react"
import { Plus, Search, X, Trash2, PackagePlus } from "lucide-react"

interface Product { id: string; title: string; sku: string | null; unitPrice: string; moq: number; inventoryQuantity: number; thumbnail: string | null }
interface User { id: string; firstName: string; lastName: string; email: string; role: string }
interface OrderItem { id: string; orderNumber: string; user: { firstName: string; lastName: string; email: string }; status: string; totalAmount: string; createdAt: string; items: { quantity: number }[] }

interface SelectedItem { product: Product; quantity: number }

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-indigo-50 text-indigo-700",
  SHIPPED: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  REFUNDED: "bg-gray-50 text-gray-700",
}

export default function AdminBulkOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedUser, setSelectedUser] = useState("")
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [addQty, setAddQty] = useState<string>("1")
  const [addProductId, setAddProductId] = useState("")
  const [notes, setNotes] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadOrders(); loadUsers(); loadProducts() }, [token])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/orders?limit=50", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setOrders((data.orders ?? []).sort((a: OrderItem, b: OrderItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (e) { console.error(e) }
  }

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?status=PUBLISHED", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch (e) { console.error(e) }
  }

  const filteredProducts = products.filter((p) => p.title.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku || "").toLowerCase().includes(productSearch.toLowerCase()))

  const addItem = () => {
    const product = products.find((p) => p.id === addProductId)
    if (!product) return
    const qty = parseInt(addQty) || product.moq
    if (selectedItems.find((i) => i.product.id === product.id)) return
    setSelectedItems([...selectedItems, { product, quantity: Math.max(qty, product.moq) }])
    setAddProductId("")
    setAddQty("1")
  }

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    setSelectedItems(selectedItems.map((i) => i.product.id === productId ? { ...i, quantity } : i))
  }

  const totalAmount = selectedItems.reduce((sum, i) => sum + Number(i.product.unitPrice) * i.quantity, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || selectedItems.length === 0) { alert("Please select a buyer and add at least one product.") ; return }
    setSaving(true)
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          userId: selectedUser,
          items: selectedItems.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          notes: notes || undefined,
        }),
      })
      if (res.ok) { resetForm(); loadOrders() }
      else { const d = await res.json(); alert(d.message || "Failed to create order") }
    } catch (e) { alert("Failed to create order") } finally { setSaving(false) }
  }

  const resetForm = () => { setSelectedUser(""); setSelectedItems([]); setNotes(""); setShowForm(false) }

  const filtered = orders.filter((o) => o.orderNumber?.toLowerCase().includes(search.toLowerCase()) || o.user?.email?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900">Bulk Orders</h1><button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><PackagePlus size={16} /> Create Bulk Order</button></div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">Create Bulk Order</h2><button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <select required value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select Buyer</option>{users.filter((u) => u.role === "BUYER" || u.role === "DISTRIBUTOR").map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select>
              <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Products</h3>
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
                <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select product</option>{filteredProducts.filter((p) => !selectedItems.find((i) => i.product.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.title} — ₹{Number(p.unitPrice).toLocaleString()} (MOQ: {p.moq})</option>)}</select>
                <input type="number" min="1" value={addQty} onChange={(e) => setAddQty(e.target.value)} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Qty" />
                <button type="button" onClick={addItem} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /></button>
              </div>

              {selectedItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-3 py-2 text-left font-medium text-gray-600">Product</th><th className="px-3 py-2 text-left font-medium text-gray-600">SKU</th><th className="px-3 py-2 text-right font-medium text-gray-600">Unit Price</th><th className="px-3 py-2 text-center font-medium text-gray-600">MOQ</th><th className="px-3 py-2 text-center font-medium text-gray-600">Quantity</th><th className="px-3 py-2 text-right font-medium text-gray-600">Subtotal</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedItems.map((item) => (
                        <tr key={item.product.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{item.product.title}</td>
                          <td className="px-3 py-2 text-gray-500">{item.product.sku || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-900">₹{Number(item.product.unitPrice).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{item.product.moq}</td>
                          <td className="px-3 py-2 text-center"><input type="number" min={item.product.moq} value={item.quantity} onChange={(e) => updateQuantity(item.product.id, Math.max(item.product.moq, parseInt(e.target.value) || item.product.moq))} className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500" /></td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">₹{(Number(item.product.unitPrice) * item.quantity).toLocaleString()}</td>
                          <td className="px-3 py-2"><button type="button" onClick={() => removeItem(item.product.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200"><tr><td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-700">Total</td><td className="px-3 py-2 text-right font-bold text-gray-900">₹{totalAmount.toLocaleString()}</td><td></td></tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving || !selectedUser || selectedItems.length === 0} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Creating..." : "Create Order"}</button></div>
          </form>
        </div>
      )}

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><p className="text-gray-600">No orders found.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Order #</th><th className="px-4 py-3 text-left font-medium text-gray-600">Buyer</th><th className="px-4 py-3 text-center font-medium text-gray-600">Items</th><th className="px-4 py-3 text-right font-medium text-gray-600">Total</th><th className="px-4 py-3 text-left font-medium text-gray-600">Status</th><th className="px-4 py-3 text-left font-medium text-gray-600">Date</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.slice(0, 50).map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{o.orderNumber?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600">{o.user?.firstName} {o.user?.lastName}<br /><span className="text-xs text-gray-400">{o.user?.email}</span></td>
                  <td className="px-4 py-3 text-center text-gray-600">{o.items?.length || 0}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{Number(o.totalAmount).toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || "bg-gray-50 text-gray-700"}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}