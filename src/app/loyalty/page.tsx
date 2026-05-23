"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Award, TrendingUp, Wallet, Gift, ArrowLeft, Crown, Star, Medal } from "lucide-react"

interface Transaction {
  id: string; type: string; points: number; amount: number | null; description: string | null; createdAt: string
}

interface LoyaltyAccount {
  id: string; points: number; tier: string; lifetimePoints: number; walletBalance: number
  transactions: Transaction[]
}

export default function LoyaltyPage() {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { setLoading(false); return }
    fetch("/api/loyalty/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setAccount(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const tierIcon = (tier: string) => {
    if (tier === "platinum") return <Crown size={24} className="text-purple-600" />
    if (tier === "gold") return <Star size={24} className="text-yellow-600" />
    if (tier === "silver") return <Medal size={24} className="text-gray-500" />
    return <Award size={24} className="text-amber-700" />
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-primary-700">WholesaleX Pro</div>
          <div className="flex gap-4">
            <Link href="/" className="text-gray-600 hover:text-primary-600">Home</Link>
            <Link href="/products" className="text-gray-600 hover:text-primary-600">Products</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-primary-600 mb-6"><ArrowLeft size={16} /> Back to home</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Loyalty Program</h1>

        {account ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Gift size={20} className="text-primary-600" />
                  <span className="text-sm text-gray-500">Available Points</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{account.points}</div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  {tierIcon(account.tier)}
                  <span className="text-sm text-gray-500">Tier</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 capitalize">{account.tier}</div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Wallet size={20} className="text-green-600" />
                  <span className="text-sm text-gray-500">Wallet Balance</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">₹{Number(account.walletBalance).toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-primary-600" />
                <h2 className="text-xl font-semibold">Transaction History</h2>
              </div>
              {account.transactions.length === 0 ? (
                <p className="text-gray-500">No transactions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Points</th><th className="px-4 py-2 text-right">Date</th></tr>
                  </thead>
                  <tbody>
                    {account.transactions.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{t.type}</td>
                        <td className="px-4 py-2 text-gray-600">{t.description || "-"}</td>
                        <td className={`px-4 py-2 text-right font-bold ${t.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {t.points > 0 ? `+${t.points}` : t.points}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <p className="text-gray-600 mb-4">Please sign in to view your loyalty account.</p>
            <Link href="/login" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Sign In</Link>
          </div>
        )}
      </main>
    </div>
  )
}
