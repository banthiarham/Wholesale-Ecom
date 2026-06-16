"use client"

import { useState, useEffect } from "react"
import { Search, CreditCard, Eye, Plus, Minus, AlertCircle, Wallet, Sliders } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface WalletTransaction {
  id: string
  type: string
  amount: number | string
  balance: number | string
  description?: string
  createdAt: string
}

interface UserWallet {
  id: string
  userId: string
  balance: number | string
  creditLimit: number | string
  createdAt: string
  updatedAt: string
  user: { id: string; firstName: string; lastName: string; email: string }
  transactions?: WalletTransaction[]
}

const TYPE_COLORS: Record<string, string> = {
  CREDIT: "bg-green-100 text-green-700",
  TOPUP: "bg-green-100 text-green-700",
  DEBIT: "bg-red-100 text-red-700",
  DEDUCTION: "bg-red-100 text-red-700",
  CASHBACK: "bg-purple-100 text-purple-700",
  REFUND: "bg-orange-100 text-orange-700",
  ADJUSTMENT: "bg-yellow-100 text-yellow-700",
}

function isCreditType(type: string): boolean {
  return type === "CREDIT" || type === "CASHBACK" || type === "REFUND" || type === "TOPUP"
}

function getAmountSign(type: string, amount: number | string): string {
  const numAmount = Number(amount)
  if (numAmount < 0) return ""
  return isCreditType(type) ? "+" : "-"
}

function getAmountColor(type: string, amount: number | string): string {
  const numAmount = Number(amount)
  if (numAmount < 0) return "text-red-700"
  return isCreditType(type) ? "text-green-700" : "text-red-700"
}

export default function AdminWalletPage() {
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [showDebitModal, setShowDebitModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [creditForm, setCreditForm] = useState({ walletId: "", amount: "", description: "" })
  const [debitForm, setDebitForm] = useState({ walletId: "", amount: "", description: "" })
  const [limitForm, setLimitForm] = useState({ walletId: "", creditLimit: "" })
  const [debitWalletBalance, setDebitWalletBalance] = useState(0)
  const [debitCreditLimit, setDebitCreditLimit] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    if (token) loadWallets()
  }, [token])

  const loadWallets = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallets", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setWallets(data.wallets || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadWalletDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/wallets/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSelectedWallet(data.wallet)
    } catch (e) {
      console.error(e)
    }
  }

  const loadTransactions = async (walletId: string) => {
    setTxLoading(true)
    try {
      const res = await fetch(`/api/wallets/${walletId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch (e) {
      console.error(e)
    } finally {
      setTxLoading(false)
    }
  }

  const openDetail = (wallet: UserWallet) => {
    setSelectedWallet(wallet)
    setError("")
    loadTransactions(wallet.id)
  }

  const openCreditModal = (wallet: UserWallet) => {
    setCreditForm({ walletId: wallet.id, amount: "", description: "" })
    setError("")
    setShowCreditModal(true)
  }

  const openDebitModal = (wallet: UserWallet) => {
    const balance = Number(wallet.balance)
    const limit = Number(wallet.creditLimit || 0)
    setDebitForm({ walletId: wallet.id, amount: "", description: "" })
    setDebitWalletBalance(balance)
    setDebitCreditLimit(limit)
    setError("")
    setShowDebitModal(true)
  }

  const openLimitModal = (wallet: UserWallet) => {
    setLimitForm({ walletId: wallet.id, creditLimit: String(Number(wallet.creditLimit || 0)) })
    setError("")
    setShowLimitModal(true)
  }

  const handleCredit = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/wallets/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          walletId: creditForm.walletId,
          amount: parseFloat(creditForm.amount),
          description: creditForm.description || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to credit wallet")
      }
      setShowCreditModal(false)
      await loadWallets()
      if (selectedWallet?.id === creditForm.walletId) {
        await loadWalletDetail(creditForm.walletId)
        await loadTransactions(creditForm.walletId)
      }
    } catch (e: any) {
      setError(e.message || "Failed to credit wallet")
    } finally {
      setSaving(false)
    }
  }

  const handleDebit = async () => {
    setSaving(true)
    setError("")
    try {
      const amount = parseFloat(debitForm.amount)
      if (isNaN(amount) || amount <= 0) throw new Error("Please enter a valid amount")
      const available = debitWalletBalance + debitCreditLimit
      if (amount > available) throw new Error(`Amount exceeds available credit of ${formatPrice(available)}`)
      const res = await fetch("/api/wallets/debit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          walletId: debitForm.walletId,
          amount,
          description: debitForm.description || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to debit wallet")
      }
      setShowDebitModal(false)
      await loadWallets()
      if (selectedWallet?.id === debitForm.walletId) {
        await loadWalletDetail(debitForm.walletId)
        await loadTransactions(debitForm.walletId)
      }
    } catch (e: any) {
      setError(e.message || "Failed to debit wallet")
    } finally {
      setSaving(false)
    }
  }

  const handleSetLimit = async () => {
    setSaving(true)
    setError("")
    try {
      const limit = parseFloat(limitForm.creditLimit)
      if (isNaN(limit) || limit < 0) throw new Error("Please enter a valid limit")
      const res = await fetch(`/api/wallets/${limitForm.walletId}/credit-limit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creditLimit: limit }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to set credit limit")
      }
      setShowLimitModal(false)
      await loadWallets()
      if (selectedWallet?.id === limitForm.walletId) {
        await loadWalletDetail(limitForm.walletId)
      }
    } catch (e: any) {
      setError(e.message || "Failed to set credit limit")
    } finally {
      setSaving(false)
    }
  }

  const filtered = wallets.filter((w) => {
    const q = search.toLowerCase()
    return (
      `${w.user.firstName} ${w.user.lastName}`.toLowerCase().includes(q) ||
      w.user.email.toLowerCase().includes(q)
    )
  })

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0)
  const totalCreditOutstanding = wallets.reduce((sum, w) => {
    const bal = Number(w.balance)
    return sum + (bal < 0 ? Math.abs(bal) : 0)
  }, 0)
  const totalCreditLimits = wallets.reduce((sum, w) => sum + Number(w.creditLimit || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Wallet</h1>
        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
          {wallets.length} wallets
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total Wallets</p>
          <p className="text-lg font-bold text-gray-900">{wallets.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total Balance</p>
          <p className="text-lg font-bold text-green-700">{formatPrice(totalBalance)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Credit Limits</p>
          <p className="text-lg font-bold text-blue-700">{formatPrice(totalCreditLimits)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-lg font-bold text-red-700">{formatPrice(totalCreditOutstanding)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Active Users</p>
          <p className="text-lg font-bold text-gray-900">{wallets.filter((w) => Number(w.balance) > 0 || Number(w.creditLimit || 0) > 0).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <Wallet size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No wallets found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Balance</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Credit Limit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Available</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((wallet) => {
                  const bal = Number(wallet.balance)
                  const limit = Number(wallet.creditLimit || 0)
                  const available = bal + limit
                  const outstanding = bal < 0 ? Math.abs(bal) : 0
                  return (
                    <tr key={wallet.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {wallet.user.firstName} {wallet.user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{wallet.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${bal > 0 ? "text-green-700" : bal < 0 ? "text-red-700" : "text-gray-500"}`}>
                          {formatPrice(bal)}
                        </span>
                        {outstanding > 0 && (
                          <p className="text-xs text-red-500">₹{outstanding.toLocaleString("en-IN")} outstanding</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-blue-700">{formatPrice(limit)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${available > 0 ? "text-gray-900" : "text-red-600"}`}>
                          {formatPrice(available)}
                        </span>
                        {available <= 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                            Limit Reached
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(wallet.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => openDetail(wallet)}
                            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            onClick={() => openLimitModal(wallet)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            <Sliders size={14} /> Limit
                          </button>
                          <button
                            onClick={() => openCreditModal(wallet)}
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            <Plus size={14} /> Credit
                          </button>
                          <button
                            onClick={() => openDebitModal(wallet)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            <Minus size={14} /> Debit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {selectedWallet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
              <button onClick={() => setSelectedWallet(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900">
                {selectedWallet.user.firstName} {selectedWallet.user.lastName}
              </p>
              <p className="text-sm text-gray-500">{selectedWallet.user.email}</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-xs text-gray-400">Balance</p>
                  <p className={`font-bold ${Number(selectedWallet.balance) >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {formatPrice(selectedWallet.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Credit Limit</p>
                  <p className="font-bold text-blue-700">{formatPrice(selectedWallet.creditLimit || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Available</p>
                  <p className={`font-bold ${Number(selectedWallet.balance) + Number(selectedWallet.creditLimit || 0) > 0 ? "text-gray-900" : "text-red-600"}`}>
                    {formatPrice(Number(selectedWallet.balance) + Number(selectedWallet.creditLimit || 0))}
                  </p>
                </div>
              </div>
            </div>

            {txLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLORS[tx.type] || "bg-gray-100 text-gray-700"}`}>
                        {tx.type}
                      </span>
                      <div>
                        {tx.description && <p className="text-sm text-gray-700">{tx.description}</p>}
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${getAmountColor(tx.type, tx.amount)}`}>
                        {getAmountSign(tx.type, tx.amount)}{formatPrice(Math.abs(Number(tx.amount)))}
                      </p>
                      <p className="text-xs text-gray-400">Bal: {formatPrice(tx.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Credit Wallet</h2>
              <button onClick={() => { setShowCreditModal(false); setError("") }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-2.5">
                <AlertCircle size={16} />{error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" min="0.01" placeholder="Enter amount" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input type="text" placeholder="Reason for credit" value={creditForm.description} onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowCreditModal(false); setError("") }} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleCredit} disabled={!creditForm.amount || saving} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Processing..." : "Credit"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debit Modal */}
      {showDebitModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Debit Wallet</h2>
              <button onClick={() => { setShowDebitModal(false); setError("") }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="mb-4 bg-blue-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Balance:</span>
                <span className="font-bold text-blue-700">{formatPrice(debitWalletBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Credit Limit:</span>
                <span className="font-bold text-blue-700">{formatPrice(debitCreditLimit)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-200 pt-1">
                <span className="text-blue-700 font-medium">Available to Debit:</span>
                <span className="font-bold text-blue-800">{formatPrice(debitWalletBalance + debitCreditLimit)}</span>
              </div>
            </div>
            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-2.5">
                <AlertCircle size={16} />{error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" min="0.01" max={debitWalletBalance + debitCreditLimit} placeholder="Enter amount" value={debitForm.amount} onChange={(e) => setDebitForm({ ...debitForm, amount: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input type="text" placeholder="Reason for debit" value={debitForm.description} onChange={(e) => setDebitForm({ ...debitForm, description: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowDebitModal(false); setError("") }} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleDebit} disabled={!debitForm.amount || saving} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Processing..." : "Debit"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Credit Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Set Credit Limit</h2>
              <button onClick={() => { setShowLimitModal(false); setError("") }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="mb-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              Set the maximum amount this user can spend beyond their wallet balance. When the limit is reached, the user must clear their outstanding bills before they can spend more.
            </div>
            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-2.5">
                <AlertCircle size={16} />{error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
                <input type="number" step="1" min="0" placeholder="e.g. 50000" value={limitForm.creditLimit} onChange={(e) => setLimitForm({ ...limitForm, creditLimit: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <p className="text-xs text-gray-400 mt-1">Set to 0 to disable credit limit</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowLimitModal(false); setError("") }} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSetLimit} disabled={limitForm.creditLimit === "" || saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Saving..." : "Set Limit"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}