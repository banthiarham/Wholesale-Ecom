"use client"

import { useState, useEffect } from "react"
import { Wallet, ArrowDownCircle, ArrowUpCircle, MinusCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface WalletTransaction {
  id: string
  type: string
  amount: number | string
  balance: number | string
  description?: string
  createdAt: string
}

function isCreditType(type: string): boolean {
  return type === "CREDIT" || type === "CASHBACK" || type === "REFUND" || type === "TOPUP"
}

export default function WalletPage() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [hasWallet, setHasWallet] = useState(true)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    if (token) loadWallet()
  }, [token])

  const loadWallet = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallets/me", { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 404) {
        setHasWallet(false)
        setLoading(false)
        return
      }
      const data = await res.json()
      const wallet = data.wallet
      if (wallet) {
        setBalance(Number(wallet.balance))
        setTransactions(wallet.transactions || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
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

  const TYPE_ICONS: Record<string, any> = {
    CREDIT: ArrowDownCircle,
    TOPUP: ArrowDownCircle,
    DEBIT: ArrowUpCircle,
    DEDUCTION: ArrowUpCircle,
    CASHBACK: ArrowDownCircle,
    REFUND: ArrowDownCircle,
    ADJUSTMENT: MinusCircle,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Wallet</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : !hasWallet ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Wallet size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No wallet found. Please contact support to set up your wallet.</p>
        </div>
      ) : (
        <>
          {/* Balance Card */}
          <div className="rounded-2xl p-6 mb-4 text-white shadow-lg bg-gradient-to-br from-primary-600 to-primary-700">
            <p className="text-sm opacity-80 mb-1">Available Balance</p>
            <p className="text-3xl font-bold">{formatPrice(balance)}</p>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Transaction History</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No transactions yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx) => {
                  const Icon = TYPE_ICONS[tx.type] || Wallet
                  const numAmount = Number(tx.amount)
                  const credit = isCreditType(tx.type) || numAmount > 0
                  const displayAmount = Math.abs(numAmount)
                  const sign = credit ? "+" : "-"
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${credit ? "bg-green-100" : "bg-red-100"}`}>
                        <Icon size={18} className={credit ? "text-green-600" : "text-red-600"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${credit ? "text-green-700" : "text-red-700"}`}>
                          {sign}{formatPrice(displayAmount)}
                        </p>
                        <p className="text-xs text-gray-400">Bal: {formatPrice(tx.balance)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}