"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Minus, Eye, X, Wallet, PackagePlus, Trash2 } from "lucide-react"

// ─── Shared Types ────────────────────────────────────────────────

interface WalletData {
  id: string; userId: string; balance: string; createdAt: string; updatedAt: string
  user: { id: string; firstName: string; lastName: string; email: string; role: string }
}
interface WalletTransaction {
  id: string; walletId: string; type: string; amount: string; balance: string
  description: string | null; referenceId: string | null; createdBy: string | null; createdAt: string
}
interface Product { id: string; title: string; sku: string | null; unitPrice: string; moq: number; inventoryQuantity: number; thumbnail: string | null }
interface SelectedItem { product: Product; quantity: number }

const TXN_TYPE_COLORS: Record<string, string> = {
  TOPUP: "bg-green-50 text-green-700", DEDUCTION: "bg-red-50 text-red-700",
  REFUND: "bg-blue-50 text-blue-700", CASHBACK: "bg-purple-50 text-purple-700",
  ADJUSTMENT: "bg-yellow-50 text-yellow-700",
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700", CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-indigo-50 text-indigo-700", SHIPPED: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-green-50 text-green-700", CANCELLED: "bg-red-50 text-red-700",
  REFUNDED: "bg-gray-50 text-gray-700",
}

const TABS = [
  { key: "bulk-orders", label: "Bulk Orders", icon: PackagePlus },
  { key: "wallet", label: "Wallet", icon: Wallet },
]

// ─── Main Component ─────────────────────────────────────────────

export default function AdminAddonsPage() {
  const [activeTab, setActiveTab] = useState("bulk-orders")
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Addons</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab.key ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bulk-orders" && <BulkOrdersTab token={token} />}
      {activeTab === "wallet" && <WalletTab token={token} />}
    </div>
  )
}

// ─── Bulk Orders Tab ─────────────────────────────────────────────

function BulkOrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState("")
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [addQty, setAddQty] = useState("1")
  const [addProductId, setAddProductId] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => { loadOrders(); loadUsers(); loadProducts() }, [token])

  const loadOrders = async () => {
    setLoading(true)
    try { const res = await fetch("/api/orders?limit=50", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setOrders((data.orders ?? []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())) } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  const loadUsers = async () => {
    try { const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setUsers(data.users ?? []) } catch (e) { console.error(e) }
  }
  const loadProducts = async () => {
    try { const res = await fetch("/api/products?status=PUBLISHED", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setProducts(data.products ?? []) } catch (e) { console.error(e) }
  }

  const filteredProducts = products.filter((p) => p.title.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku || "").toLowerCase().includes(productSearch.toLowerCase()))
  const totalAmount = selectedItems.reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0)

  const addItem = () => {
    const product = products.find((p) => p.id === addProductId); if (!product) return
    const qty = parseInt(addQty) || product.moq
    if (selectedItems.find((i) => i.product.id === product.id)) return
    setSelectedItems([...selectedItems, { product, quantity: Math.max(qty, product.moq) }]); setAddProductId(""); setAddQty("1")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || selectedItems.length === 0) { alert("Select a buyer and add products."); return }
    setSaving(true)
    try {
      const res = await fetch("/api/orders/bulk", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: selectedUser, items: selectedItems.map((i) => ({ productId: i.product.id, quantity: i.quantity })), notes: notes || undefined }) })
      if (res.ok) { resetForm(); loadOrders() } else { const d = await res.json(); alert(d.message || "Failed") }
    } catch { alert("Failed") } finally { setSaving(false) }
  }

  const resetForm = () => { setSelectedUser(""); setSelectedItems([]); setNotes(""); setShowForm(false) }
  const filtered = orders.filter((o: any) => o.orderNumber?.toLowerCase().includes(search.toLowerCase()) || o.user?.email?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><PackagePlus size={16} /> Create Bulk Order</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">Create Bulk Order</h2><button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-3 py-2 text-left font-medium text-gray-600">Product</th><th className="px-3 py-2 text-right font-medium text-gray-600">Price</th><th className="px-3 py-2 text-center font-medium text-gray-600">Qty</th><th className="px-3 py-2 text-right font-medium text-gray-600">Subtotal</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody className="divide-y divide-gray-50">{selectedItems.map((item) => (
                      <tr key={item.product.id} className="hover:bg-gray-50"><td className="px-3 py-2 font-medium">{item.product.title}</td><td className="px-3 py-2 text-right">₹{Number(item.product.unitPrice).toLocaleString()}</td><td className="px-3 py-2 text-center"><input type="number" min={item.product.moq} value={item.quantity} onChange={(e) => setSelectedItems(selectedItems.map((i) => i.product.id === item.product.id ? { ...i, quantity: Math.max(item.product.moq, parseInt(e.target.value) || item.product.moq) } : i))} className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500" /></td><td className="px-3 py-2 text-right font-semibold">₹{(Number(item.product.unitPrice) * item.quantity).toLocaleString()}</td><td className="px-3 py-2"><button type="button" onClick={() => setSelectedItems(selectedItems.filter((i) => i.product.id !== item.product.id))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td></tr>
                    ))}</tbody>
                    <tfoot className="border-t border-gray-200"><tr><td colSpan={3} className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right font-bold">₹{totalAmount.toLocaleString()}</td><td></td></tr></tfoot>
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
            <tbody className="divide-y divide-gray-50">{filtered.slice(0, 50).map((o: any) => (
              <tr key={o.id} className="hover:bg-gray-50 transition"><td className="px-4 py-3 font-medium text-gray-900">{o.orderNumber?.slice(0, 8)}</td><td className="px-4 py-3 text-gray-600">{o.user?.firstName} {o.user?.lastName}<br /><span className="text-xs text-gray-400">{o.user?.email}</span></td><td className="px-4 py-3 text-center text-gray-600">{o.items?.length || 0}</td><td className="px-4 py-3 text-right font-semibold">₹{Number(o.totalAmount).toLocaleString()}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || "bg-gray-50 text-gray-700"}`}>{o.status}</span></td><td className="px-4 py-3 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Wallet Tab ──────────────────────────────────────────────────

function WalletTab({ token }: { token: string }) {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showTopup, setShowTopup] = useState(false)
  const [showDeduct, setShowDeduct] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [showTxns, setShowTxns] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ userId: "", amount: "", description: "" })

  useEffect(() => { loadWallets(); loadUsers() }, [token])

  const loadWallets = async () => {
    setLoading(true)
    try { const res = await fetch("/api/wallet/admin", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setWallets(data.wallets ?? []) } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  const loadUsers = async () => {
    try { const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setUsers(data.users ?? []) } catch (e) { console.error(e) }
  }
  const loadTransactions = async (userId: string) => {
    try { const res = await fetch(`/api/wallet/admin/${userId}`, { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setTransactions(data.transactions ?? []) } catch (e) { console.error(e) }
  }

  const filtered = wallets.filter((w) => w.user?.firstName?.toLowerCase().includes(search.toLowerCase()) || w.user?.lastName?.toLowerCase().includes(search.toLowerCase()) || w.user?.email?.toLowerCase().includes(search.toLowerCase()))
  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)

  const handleSubmit = async (type: "topup" | "deduct" | "adjust") => {
    setSaving(true)
    try {
      const res = await fetch(`/api/wallet/${type}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: form.userId, amount: Number(form.amount), description: form.description || undefined }) })
      if (res.ok) { loadWallets(); resetForm() } else { const d = await res.json(); alert(d.message || "Failed") }
    } catch { alert("Failed") } finally { setSaving(false) }
  }

  const resetForm = () => { setForm({ userId: "", amount: "", description: "" }); setShowTopup(false); setShowDeduct(false); setShowAdjust(false) }
  const openTransactions = (w: WalletData) => { setSelectedWallet(w); loadTransactions(w.userId); setShowTxns(true) }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => { resetForm(); setShowTopup(true) }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"><Plus size={16} /> Top Up</button>
        <button onClick={() => { resetForm(); setShowDeduct(true) }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"><Minus size={16} /> Deduct</button>
        <button onClick={() => { resetForm(); setShowAdjust(true) }} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition"><Wallet size={16} /> Adjust</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><p className="text-sm text-gray-500 mb-1">Total Balance</p><p className="text-2xl font-bold text-gray-900">₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><p className="text-sm text-gray-500 mb-1">Active Wallets</p><p className="text-2xl font-bold text-gray-900">{wallets.length}</p></div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><p className="text-sm text-gray-500 mb-1">Avg Balance</p><p className="text-2xl font-bold text-gray-900">₹{wallets.length > 0 ? (totalBalance / wallets.length).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}</p></div>
      </div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search wallets by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>

      {(showTopup || showDeduct || showAdjust) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">{showTopup ? "Top Up Wallet" : showDeduct ? "Deduct from Wallet" : "Adjust Wallet Balance"}</h2><button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(showTopup ? "topup" : showDeduct ? "deduct" : "adjust") }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select user</option>{users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select>
            <input required type="number" step="0.01" min="0.01" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className={`px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${showTopup ? "bg-green-600 hover:bg-green-700" : showDeduct ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700"}`}>{saving ? "Processing..." : showTopup ? "Top Up" : showDeduct ? "Deduct" : "Adjust"}</button></div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center"><p className="text-gray-600">No wallets found. Top up a wallet to get started.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">User</th><th className="px-4 py-3 text-left font-medium text-gray-600">Email</th><th className="px-4 py-3 text-left font-medium text-gray-600">Role</th><th className="px-4 py-3 text-right font-medium text-gray-600">Balance</th><th className="px-4 py-3 text-left font-medium text-gray-600">Last Updated</th><th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{filtered.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50 transition"><td className="px-4 py-3 font-medium text-gray-900">{w.user?.firstName} {w.user?.lastName}</td><td className="px-4 py-3 text-gray-600">{w.user?.email}</td><td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{w.user?.role}</span></td><td className="px-4 py-3 text-right font-semibold text-gray-900">₹{Number(w.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td className="px-4 py-3 text-xs text-gray-500">{new Date(w.updatedAt).toLocaleDateString()}</td><td className="px-4 py-3 text-right"><button onClick={() => openTransactions(w)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50"><Eye size={14} /></button></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {showTxns && selectedWallet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTxns(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100"><h3 className="text-lg font-semibold text-gray-900">Transactions — {selectedWallet.user?.firstName} {selectedWallet.user?.lastName}</h3><button onClick={() => setShowTxns(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4">Current Balance: <span className="font-bold text-gray-900">₹{Number(selectedWallet.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
              {transactions.length === 0 ? <p className="text-gray-500 text-center py-8">No transactions yet.</p> : (
                <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-gray-600">Date</th><th className="px-3 py-2 text-left text-gray-600">Type</th><th className="px-3 py-2 text-right text-gray-600">Amount</th><th className="px-3 py-2 text-right text-gray-600">Balance After</th><th className="px-3 py-2 text-left text-gray-600">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">{transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50"><td className="px-3 py-2 text-gray-600">{new Date(t.createdAt).toLocaleString()}</td><td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TXN_TYPE_COLORS[t.type] || "bg-gray-50 text-gray-700"}`}>{t.type}</span></td><td className={`px-3 py-2 text-right font-medium ${Number(t.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{Number(t.amount) >= 0 ? "+" : ""}₹{Math.abs(Number(t.amount)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td className="px-3 py-2 text-right text-gray-900">₹{Number(t.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td className="px-3 py-2 text-gray-500">{t.description || "—"}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}