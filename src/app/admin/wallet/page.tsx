"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Minus, Eye, X, Wallet } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface WalletData {
  id: string
  userId: string
  balance: string
  createdAt: string
  updatedAt: string
  user: { id: string; firstName: string; lastName: string; email: string; role: string }
}

interface Transaction {
  id: string
  walletId: string
  type: string
  amount: string
  balance: string
  description: string | null
  referenceId: string | null
  createdBy: string | null
  createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  TOPUP: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DEDUCTION: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REFUND: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  CASHBACK: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  ADJUSTMENT: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
}

export default function AdminWalletPage() {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showTopup, setShowTopup] = useState(false)
  const [showDeduct, setShowDeduct] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [showTxns, setShowTxns] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ userId: "", amount: "", description: "" })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadWallets(); loadUsers() }, [token])

  const loadWallets = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/admin", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setWallets(data.wallets ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (e) { console.error(e) }
  }

  const loadTransactions = async (userId: string) => {
    try {
      const res = await fetch(`/api/wallet/admin/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setTransactions(data.transactions ?? [])
    } catch (e) { console.error(e) }
  }

  const filtered = wallets.filter((w) =>
    w.user?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0)

  const handleSubmit = async (type: "topup" | "deduct" | "adjust") => {
    setSaving(true)
    const t = localStorage.getItem("token")!
    try {
      const res = await fetch(`/api/wallet/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ userId: form.userId, amount: Number(form.amount), description: form.description || undefined }),
      })
      if (res.ok) { loadWallets(); resetForm() }
      else { const d = await res.json(); alert(d.message || "Failed") }
    } catch (e) { alert("Failed") } finally { setSaving(false) }
  }

  const resetForm = () => { setForm({ userId: "", amount: "", description: "" }); setShowTopup(false); setShowDeduct(false); setShowAdjust(false) }

  const openTransactions = (w: WalletData) => {
    setSelectedWallet(w)
    loadTransactions(w.userId)
    setShowTxns(true)
  }

  if (loading) return <SkeletonTable />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Wallet Management</h1><div className="flex gap-2"><button onClick={() => { resetForm(); setShowTopup(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"><Plus size={16} /> Top Up</button><button onClick={() => { resetForm(); setShowDeduct(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"><Minus size={16} /> Deduct</button><button onClick={() => { resetForm(); setShowAdjust(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition"><Wallet size={16} /> Adjust</button></div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5"><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Balance</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5"><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active Wallets</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wallets.length}</p></div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5"><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avg Balance</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{wallets.length > 0 ? (totalBalance / wallets.length).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}</p></div>
      </div>

      <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" /><input type="text" placeholder="Search wallets by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>

      {(showTopup || showDeduct || showAdjust) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{showTopup ? "Top Up Wallet" : showDeduct ? "Deduct from Wallet" : "Adjust Wallet Balance"}</h2><button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button></div>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(showTopup ? "topup" : showDeduct ? "deduct" : "adjust") }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"><option value="">Select user</option>{users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select>
            <input required type="number" step="0.01" min="0.01" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3"><button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button><button type="submit" disabled={saving} className={`px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${showTopup ? "bg-green-600 hover:bg-green-700" : showDeduct ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700"}`}>{saving ? "Processing..." : showTopup ? "Top Up" : showDeduct ? "Deduct" : "Adjust"}</button></div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center"><p className="text-gray-600 dark:text-gray-400">No wallets found. Top up a wallet to get started.</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">User</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Role</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Last Updated</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{w.user?.firstName} {w.user?.lastName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{w.user?.email}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{w.user?.role}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">₹{Number(w.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(w.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openTransactions(w)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"><Eye size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTxns && selectedWallet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTxns(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800"><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transactions — {selectedWallet.user?.firstName} {selectedWallet.user?.lastName}</h3><button onClick={() => setShowTxns(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button></div>
            <div className="p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Current Balance: <span className="font-bold text-gray-900 dark:text-gray-100">₹{Number(selectedWallet.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
              {transactions.length === 0 ? <p className="text-gray-500 dark:text-gray-400 text-center py-8">No transactions yet.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50"><tr><th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Date</th><th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Type</th><th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Amount</th><th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Balance After</th><th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{new Date(t.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t.type] || "bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400"}`}>{t.type}</span></td>
                        <td className={`px-3 py-2 text-right font-medium ${Number(t.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{Number(t.amount) >= 0 ? "+" : ""}₹{Math.abs(Number(t.amount)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">₹{Number(t.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{t.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}