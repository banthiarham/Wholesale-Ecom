"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  BookOpen, ArrowLeft, ShoppingBag, CreditCard, RotateCcw, RefreshCcw, Wallet, Filter,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { EmptyState } from "@/components/ui/EmptyState"

type LedgerSource = "ORDER" | "PAYMENT" | "RETURN" | "REFUND" | "WALLET"

interface LedgerEntry {
  id: string
  source: LedgerSource
  date: string
  description: string
  amount: number
  direction: "DEBIT" | "CREDIT"
  status: string
  referenceId: string
  runningBalance: number | null
}

interface LedgerSummary {
  totalOrders: number
  totalOrderValue: number
  paymentsMade: number
  pendingAmount: number
  returnsCount: number
  returnsAmount: number
  replacementsCount: number
  refundsTotal: number
  credits: number
  debits: number
  walletBalance: number
  creditLimit: number
  availableCredit: number
}

const SOURCE_META: Record<LedgerSource, { label: string; icon: any; color: string }> = {
  ORDER: { label: "Order", icon: ShoppingBag, color: "bg-primary-50 text-primary-700 border-primary-100" },
  PAYMENT: { label: "Payment", icon: CreditCard, color: "bg-green-50 text-green-700 border-green-100" },
  RETURN: { label: "Return", icon: RotateCcw, color: "bg-amber-50 text-amber-700 border-amber-100" },
  REFUND: { label: "Refund", icon: RefreshCcw, color: "bg-blue-50 text-blue-700 border-blue-100" },
  WALLET: { label: "Wallet", icon: Wallet, color: "bg-purple-50 text-purple-700 border-purple-100" },
}

const SOURCE_FILTERS: ("All" | LedgerSource)[] = ["All", "ORDER", "PAYMENT", "RETURN", "REFUND", "WALLET"]

export default function LedgerPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<"All" | LedgerSource>("All")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const load = useCallback(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set("from", new Date(from).toISOString())
    if (to) params.set("to", new Date(to).toISOString())
    if (sourceFilter !== "All") params.set("sources", sourceFilter)
    fetch(`/api/ledger/me?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        setSummary(data.summary || null)
        setEntries(data.entries || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router, from, to, sourceFilter])

  useEffect(() => { load() }, [load])

  if (loading && !summary) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BookOpen size={22} className="text-primary-600" /> Ledger</h1>
            <p className="text-sm text-gray-500 mt-1">Complete transaction history — orders, payments, returns, refunds, and wallet activity.</p>
          </div>
          <Link href="/orders" className="flex items-center gap-1 text-sm text-primary-600 hover:underline shrink-0">
            <ArrowLeft size={16} /> Back to Orders
          </Link>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatTile label="Total Orders" value={String(summary.totalOrders)} />
            <StatTile label="Payments Made" value={formatPrice(summary.paymentsMade)} />
            <StatTile label="Pending Amount" value={formatPrice(summary.pendingAmount)} />
            <StatTile label="Returns" value={`${summary.returnsCount} · ${formatPrice(summary.returnsAmount)}`} />
            <StatTile label="Replacements" value={String(summary.replacementsCount)} />
            <StatTile label="Refunds" value={formatPrice(summary.refundsTotal)} />
          </div>
        )}

        {summary && (
          <div className="card-base-static p-4 mb-6 flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-gray-500">Wallet Balance</p>
              <p className="text-lg font-bold text-gray-900">{formatPrice(summary.walletBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Credits</p>
              <p className="text-sm font-semibold text-green-600">+{formatPrice(summary.credits)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Debits</p>
              <p className="text-sm font-semibold text-red-600">-{formatPrice(summary.debits)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Available Credit</p>
              <p className="text-sm font-semibold text-gray-900">{formatPrice(summary.availableCredit)}</p>
            </div>
          </div>
        )}

        <div className="card-base-static p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 shrink-0"><Filter size={14} /> Filter:</div>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    sourceFilter === s ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"
                  }`}
                >
                  {s === "All" ? "All" : SOURCE_META[s].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" />
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState icon={BookOpen} title="No transactions found" description="Your orders, payments, returns, and wallet activity will show up here." />
        ) : (
          <div className="card-base-static overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Wallet Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map((entry) => {
                    const meta = SOURCE_META[entry.source]
                    const Icon = meta.icon
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${meta.color}`}>
                            <Icon size={12} /> {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{entry.description}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(entry.date).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-gray-500">{entry.status}</td>
                        <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${entry.direction === "CREDIT" ? "text-green-600" : "text-gray-900"}`}>
                          {entry.direction === "CREDIT" ? "+" : "-"}{formatPrice(entry.amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                          {entry.runningBalance != null ? formatPrice(entry.runningBalance) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm sm:text-base font-extrabold text-gray-900 leading-tight tracking-tight break-words">{value}</p>
      <p className="text-xs font-semibold text-gray-500 mt-2">{label}</p>
    </div>
  )
}
