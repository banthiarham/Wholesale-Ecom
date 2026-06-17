"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Minus, Eye, X, Wallet, CreditCard, ShieldCheck } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface WalletData {
  id: string
  userId: string
  balance: string
  creditLimit: string
  createdAt: string
  updatedAt: string
  user: { id: string; firstName: string; lastName: string; email: string; role: string }
}

interface CreditInfo {
  walletId: string
  userId: string
  balance: number
  creditLimit: number
  availableCredit: number
  outstanding: number
  limitReached: boolean
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
  CREDIT: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DEDUCTION: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  DEBIT: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
  const [showCreditLimit, setShowCreditLimit] = useState(false)
  const [showTxns, setShowTxns] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [selectedCreditInfo, setSelectedCreditInfo] = useState<CreditInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ userId: "", amount: "", description: "" })
  const [creditLimitForm, setCreditLimitForm] = useState({ walletId: "", creditLimit: "" })

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadWallets() }, [token])

  const loadWallets = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallets", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setWallets(data.wallets ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const loadTransactions = async (walletId: string) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}/transactions`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setTransactions(data.transactions ?? [])
    } catch (e) { console.error(e) }
  }

  const loadCreditInfo = async (walletId: string) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}/credit-info`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setSelectedCreditInfo(data.creditInfo)
      }
    } catch (e) { console.error(e) }
  }

  const openTransactions = (w: WalletData) => {
    setSelectedWallet(w)
    loadTransactions(w.id)
    loadCreditInfo(w.id)
    setShowTxns(true)
  }

  const openCreditLimit = (w: WalletData) => {
    setSelectedWallet(w)
    setCreditLimitForm({ walletId: w.id, creditLimit: Number(w.creditLimit) > 0 ? w.creditLimit : "" })
    setShowCreditLimit(true)
  }

  const filtered = wallets.filter((w) =>
    w.user?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0)
  const totalCreditLimit = wallets.reduce((sum, w) => sum + Number(w.creditLimit), 0)
  const totalOutstanding = wallets.reduce((sum, w) => sum + (Number(w.balance) < 0 ? Math.abs(Number(w.balance)) : 0), 0)

  // Find wallet id for a given userId
  const getWalletIdForUser = (userId: string): string | undefined => {
    const w = wallets.find(w => w.userId === userId)
    return w?.id
  }

  const handleTopup = async () => {
    setSaving(true)
    const walletId = getWalletIdForUser(form.userId)
    if (!walletId) { alert("Wallet not found for this user"); setSaving(false); return }
    try {
      const res = await fetch("/api/wallets/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletId, amount: Number(form.amount), description: form.description || undefined }),
      })
      if (res.ok) { loadWallets(); resetForm() }
      else { const d = await res.json(); alert(d.message || "Failed to top up") }
    } catch (e) { alert("Failed to top up") } finally { setSaving(false) }
  }

  const handleDeduct = async () => {
    setSaving(true)
    const walletId = getWalletIdForUser(form.userId)
    if (!walletId) { alert("Wallet not found for this user"); setSaving(false); return }
    try {
      const res = await fetch("/api/wallets/debit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletId, amount: Number(form.amount), description: form.description || undefined }),
      })
      if (res.ok) { loadWallets(); resetForm() }
      else { const d = await res.json(); alert(d.message || "Failed to deduct") }
    } catch (e) { alert("Failed to deduct") } finally { setSaving(false) }
  }

  const handleSetCreditLimit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/wallets/${creditLimitForm.walletId}/credit-limit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creditLimit: Number(creditLimitForm.creditLimit) }),
      })
      if (res.ok) {
        loadWallets()
        if (selectedWallet) loadCreditInfo(selectedWallet.id)
        setShowCreditLimit(false)
      } else {
        const d = await res.json()
        alert(d.message || "Failed to set credit limit")
      }
    } catch (e) { alert("Failed to set credit limit") } finally { setSaving(false) }
  }

  const resetForm = () => {
    setForm({ userId: "", amount: "", description: "" })
    setShowTopup(false)
    setShowDeduct(false)
  }

  if (loading) return <SkeletonTable />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Wallet Management</h1>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setShowTopup(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"><Plus size={16} /> Top Up</button>
          <button onClick={() => { resetForm(); setShowDeduct(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"><Minus size={16} /> Deduct</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Balance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active Wallets</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wallets.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Credit Limit</p>
          <p className="text-2xl font-bold text-blue-700">₹{totalCreditLimit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Outstanding</p>
          <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-red-700" : "text-gray-900 dark:text-gray-100"}`}>₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input type="text" placeholder="Search wallets by user..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {/* Top Up / Deduct Form */}
      {(showTopup || showDeduct) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{showTopup ? "Top Up Wallet" : "Deduct from Wallet"}</h2>
            <button onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); showTopup ? handleTopup() : handleDeduct() }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select user</option>
              {wallets.map((w) => <option key={w.userId} value={w.userId}>{w.user?.firstName} {w.user?.lastName} ({w.user?.email})</option>)}
            </select>
            <input required type="number" step="0.01" min="0.01" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
              <button type="submit" disabled={saving} className={`px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${showTopup ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>{saving ? "Processing..." : showTopup ? "Top Up" : "Deduct"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Set Credit Limit Modal */}
      {showCreditLimit && selectedWallet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreditLimit(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Set Credit Limit</h3>
              <button onClick={() => setShowCreditLimit(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">User: <span className="font-medium text-gray-900 dark:text-gray-100">{selectedWallet.user?.firstName} {selectedWallet.user?.lastName}</span></p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance: <span className="font-medium text-gray-900 dark:text-gray-100">₹{Number(selectedWallet.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
                {selectedCreditInfo && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Available Credit: <span className="font-medium text-green-700">₹{selectedCreditInfo.availableCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
                    {selectedCreditInfo.outstanding > 0 && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding: <span className="font-medium text-red-700">₹{selectedCreditInfo.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter credit limit"
                  value={creditLimitForm.creditLimit}
                  onChange={(e) => setCreditLimitForm({ ...creditLimitForm, creditLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Set to 0 to disable credit limit for this wallet.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCreditLimit(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button>
                <button onClick={handleSetCreditLimit} disabled={saving || !creditLimitForm.creditLimit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"><ShieldCheck size={14} /> {saving ? "Saving..." : "Set Limit"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Table */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">No wallets found. Top up a wallet to get started.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Credit Limit</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Available Credit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Last Updated</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((w) => {
                const balance = Number(w.balance)
                const creditLimit = Number(w.creditLimit)
                const availableCredit = balance + creditLimit
                const outstanding = balance < 0 ? Math.abs(balance) : 0
                return (
                  <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{w.user?.firstName} {w.user?.lastName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{w.user?.email}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${balance < 0 ? "text-red-700" : "text-gray-900 dark:text-gray-100"}`}>₹{Math.abs(balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}{balance < 0 ? " DR" : ""}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">₹{creditLimit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${availableCredit <= 0 ? "text-red-700" : "text-green-700"}`}>₹{Math.max(0, availableCredit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(w.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openCreditLimit(w)} className="p-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Set Credit Limit"><CreditCard size={14} /></button>
                        <button onClick={() => openTransactions(w)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20" title="View Transactions"><Eye size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxns && selectedWallet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTxns(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transactions — {selectedWallet.user?.firstName} {selectedWallet.user?.lastName}</h3>
              <button onClick={() => setShowTxns(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-5">
              {/* Wallet Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                  <p className={`text-lg font-bold ${Number(selectedWallet.balance) < 0 ? "text-red-700" : "text-gray-900 dark:text-gray-100"}`}>₹{Math.abs(Number(selectedWallet.balance)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}{Number(selectedWallet.balance) < 0 ? " DR" : ""}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs text-blue-600">Credit Limit</p>
                  <p className="text-lg font-bold text-blue-700">₹{Number(selectedWallet.creditLimit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <p className="text-xs text-green-600">Available Credit</p>
                  <p className={`text-lg font-bold ${selectedCreditInfo && selectedCreditInfo.availableCredit <= 0 ? "text-red-700" : "text-green-700"}`}>
                    ₹{selectedCreditInfo ? selectedCreditInfo.availableCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : (Number(selectedWallet.balance) + Number(selectedWallet.creditLimit)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs text-red-600">Outstanding</p>
                  <p className={`text-lg font-bold ${selectedCreditInfo && selectedCreditInfo.outstanding > 0 ? "text-red-700" : "text-gray-500"}`}>
                    ₹{selectedCreditInfo ? selectedCreditInfo.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : (Number(selectedWallet.balance) < 0 ? Math.abs(Number(selectedWallet.balance)).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00")}
                  </p>
                </div>
              </div>

              {selectedCreditInfo && selectedCreditInfo.limitReached && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <span className="text-red-700 dark:text-red-400 text-sm font-medium">⚠️ Credit limit reached — user cannot make purchases until outstanding is cleared.</span>
                </div>
              )}

              {transactions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No transactions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Date</th>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Type</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Amount</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Balance After</th>
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Description</th>
                    </tr>
                  </thead>
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