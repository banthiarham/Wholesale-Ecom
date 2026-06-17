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

interface CreditInfo {
  walletId: string
  userId: string
  balance: number
  creditLimit: number
  availableCredit: number
  outstanding: number
  limitReached: boolean
}

function isCreditType(type: string): boolean {
  return type === "CREDIT" || type === "CASHBACK" || type === "REFUND" || type === "TOPUP"
}

export default function WalletPage() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasWallet, setHasWallet] = useState(true)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => {
    if (token) loadWallet()
  }, [token])

  const loadWallet = async () => {
    setLoading(true)
    try {
      const [walletRes, creditRes] = await Promise.all([
        fetch("/api/wallets/me", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/wallets/me/credit-info", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ])

      if (walletRes.status === 404) {
        setHasWallet(false)
        setLoading(false)
        return
      }

      const walletData = await walletRes.json()
      const wallet = walletData.wallet
      if (wallet) {
        setBalance(Number(wallet.balance))
        setTransactions(wallet.transactions || [])
      }

      if (creditRes && creditRes.ok) {
        const creditData = await creditRes.json()
        setCreditInfo(creditData.creditInfo)
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

  const hasCreditLimit = creditInfo && creditInfo.creditLimit > 0
  const creditUsagePercent = hasCreditLimit
    ? Math.min(100, Math.round((creditInfo!.outstanding / creditInfo!.creditLimit) * 100))
    : 0

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
          <div className={`rounded-2xl p-6 mb-4 text-white shadow-lg ${
            creditInfo?.limitReached
              ? "bg-gradient-to-br from-red-500 to-red-600"
              : "bg-gradient-to-br from-primary-600 to-primary-700"
          }`}>
            <p className="text-sm opacity-80 mb-1">
              {balance >= 0 ? "Available Balance" : "Outstanding Balance"}
            </p>
            <p className="text-3xl font-bold">
              {balance >= 0 ? formatPrice(balance) : `- ${formatPrice(Math.abs(balance))}`}
            </p>
            {creditInfo?.limitReached && (
              <p className="text-sm mt-2 opacity-90">
                ⚠️ Credit limit reached. Pay your outstanding bills to continue spending.
              </p>
            )}
          </div>

          {/* Credit Limit Info */}
          {hasCreditLimit && creditInfo && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Credit Limit</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400">Credit Limit</p>
                  <p className="text-lg font-bold text-blue-700">{formatPrice(creditInfo.creditLimit)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Available Credit</p>
                  <p className={`text-lg font-bold ${creditInfo.availableCredit > 0 ? "text-green-700" : "text-red-600"}`}>
                    {formatPrice(creditInfo.availableCredit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Outstanding</p>
                  <p className={`text-lg font-bold ${creditInfo.outstanding > 0 ? "text-red-700" : "text-gray-500"}`}>
                    {formatPrice(creditInfo.outstanding)}
                  </p>
                </div>
              </div>

              {/* Credit Usage Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Credit Used</span>
                  <span>{creditUsagePercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      creditUsagePercent >= 90 ? "bg-red-500" : creditUsagePercent >= 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                    style={{ width: `${creditUsagePercent}%` }}
                  ></div>
                </div>
              </div>

              {creditInfo.outstanding > 0 && (
                <p className="mt-3 text-sm text-red-600">
                  Pay <span className="font-bold">{formatPrice(creditInfo.outstanding)}</span> to free up your credit limit
                </p>
              )}
            </div>
          )}

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