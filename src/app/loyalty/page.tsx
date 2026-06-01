"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Award, TrendingUp, Wallet, Gift, ArrowLeft, Crown, Star, Medal, Zap, Copy, Check, Users } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Transaction {
  id: string; type: string; points: number; amount: number | null; description: string | null; createdAt: string
}

interface LoyaltyAccount {
  id: string; points: number; tier: string; lifetimePoints: number; walletBalance: number
  transactions: Transaction[]
}

const tierConfig: Record<string, { name: string; minPoints: number; color: string; bg: string }> = {
  bronze:   { name: "Bronze",   minPoints: 0,     color: "text-amber-700",  bg: "bg-amber-50" },
  silver:  { name: "Silver",   minPoints: 1000,  color: "text-gray-700",   bg: "bg-gray-50" },
  gold:    { name: "Gold",     minPoints: 5000,  color: "text-yellow-700", bg: "bg-yellow-50" },
  platinum:{ name: "Platinum", minPoints: 10000, color: "text-purple-700", bg: "bg-purple-50" },
}

export default function LoyaltyPage() {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeemPoints, setRedeemPoints] = useState("")
  const [redeemDesc, setRedeemDesc] = useState("")
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState("")
  const [earningRules, setEarningRules] = useState<any[]>([])
  const [referralCode, setReferralCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [referralInput, setReferralInput] = useState("")
  const [referralMsg, setReferralMsg] = useState("")

  const loadAccount = () => {
    const token = localStorage.getItem("token")
    if (!token) { setLoading(false); return }
    fetch("/api/loyalty/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setAccount(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadAccount() }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return
    // Fetch earning rules
    fetch("/api/loyalty/rules", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setEarningRules(data.rules || []))
      .catch(() => {})
    // Fetch referral code
    fetch("/api/loyalty/referral-code", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setReferralCode(data.referralCode || ""))
      .catch(() => {})
  }, [])

  const handleApplyReferral = async () => {
    if (!referralInput.trim()) return
    setReferralMsg("")
    const token = localStorage.getItem("token")!
    try {
      const res = await fetch("/api/loyalty/apply-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: referralInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setReferralMsg("Referral code applied successfully!")
        setReferralInput("")
      } else {
        setReferralMsg(data.message || "Failed to apply referral code")
      }
    } catch { setReferralMsg("Failed to apply referral code") }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const ruleTypeIcons: Record<string, string> = {
    LOYALTY_ORDER_EARN: "🛒",
    LOYALTY_CATEGORY_BONUS: "📦",
    LOYALTY_FIRST_ORDER_BONUS: "🎉",
    LOYALTY_REVIEW_BONUS: "⭐",
    LOYALTY_REFERRAL_BONUS: "👥",
  }

  const formatRuleDescription = (rule: any) => {
    const actions = rule.actions || {}
    switch (rule.type) {
      case "LOYALTY_ORDER_EARN":
        return `Earn ${actions.pointsPerUnit || "?"} points for every ₹${actions.unitAmount || "?"} spent`
      case "LOYALTY_CATEGORY_BONUS":
        return `Earn ${actions.bonusPoints || "?"} bonus points`
      case "LOYALTY_FIRST_ORDER_BONUS":
        return `Earn ${actions.bonusPoints || "?"} bonus points on your first order`
      case "LOYALTY_REVIEW_BONUS":
        return `Earn ${actions.bonusPoints || "?"} points for writing a review`
      case "LOYALTY_REFERRAL_BONUS":
        return `Earn ${actions.referrerPoints || "?"} points for referring a friend`
      default:
        return rule.description || ""
    }
  }

  const handleRedeem = async () => {
    const points = Number(redeemPoints)
    if (!points || points <= 0) return
    if (account && points > account.points) { setRedeemMsg("Not enough points"); return }
    setRedeeming(true); setRedeemMsg("")
    const token = localStorage.getItem("token")!
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ points, description: redeemDesc || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setRedeemMsg("Points redeemed successfully! Credit added to wallet.")
        setRedeemPoints(""); setRedeemDesc("")
        loadAccount()
      } else {
        setRedeemMsg(data.message || "Failed to redeem points")
      }
    } catch { setRedeemMsg("Failed to redeem points") } finally { setRedeeming(false) }
  }

  const currentTier = account ? tierConfig[account.tier] || tierConfig.bronze : null
  const nextTier = account ? Object.values(tierConfig).find(t => t.minPoints > (account.lifetimePoints || 0)) : null
  const progressPercent = account && nextTier
    ? ((account.lifetimePoints - (currentTier?.minPoints || 0)) / ((nextTier.minPoints) - (currentTier?.minPoints || 0))) * 100
    : 100

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

            {/* Tier Progress */}
            {nextTier && (
              <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${currentTier?.color}`}>{currentTier?.name}</span>
                    <span className="text-gray-400">→</span>
                    <span className={`font-semibold ${nextTier.color}`}>{nextTier.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{account.lifetimePoints} / {nextTier.minPoints} lifetime points</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-primary-600 h-3 rounded-full transition-all" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">Earn {nextTier.minPoints - account.lifetimePoints} more lifetime points to reach {nextTier.name}</p>
              </div>
            )}

            {/* How to Earn Points */}
            {earningRules.length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={20} className="text-primary-600" />
                  <h2 className="text-xl font-semibold">How to Earn Points</h2>
                </div>
                <div className="space-y-3">
                  {earningRules.map((rule) => (
                    <div key={rule.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                      <span className="text-xl">{ruleTypeIcons[rule.type] || "🎯"}</span>
                      <div>
                        <p className="font-medium text-gray-900">{rule.name}</p>
                        <p className="text-sm text-gray-600">{formatRuleDescription(rule)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referral Code */}
            {account && referralCode && (
              <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={20} className="text-primary-600" />
                  <h2 className="text-xl font-semibold">Refer a Friend</h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">Share your referral code with friends. When they make their first order, you both earn bonus points!</p>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-mono text-lg tracking-wider text-primary-700">
                    {referralCode}
                  </div>
                  <button onClick={handleCopyCode} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium">
                    {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
                  </button>
                </div>
                {true && (
                  <div className="border-t border-gray-100 pt-4 mt-4">
                    <p className="text-sm text-gray-600 mb-2">Have a referral code? Enter it below:</p>
                    <div className="flex gap-2">
                      <input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} placeholder="Enter referral code" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <button onClick={handleApplyReferral} disabled={!referralInput.trim()} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm font-medium">Apply</button>
                    </div>
                    {referralMsg && (
                      <p className={`text-sm mt-2 ${referralMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{referralMsg}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Redeem Points */}
            {account.points > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={20} className="text-primary-600" />
                  <h2 className="text-xl font-semibold">Redeem Points</h2>
                </div>
                {redeemMsg && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${redeemMsg.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {redeemMsg}
                  </div>
                )}
                <p className="text-sm text-gray-600 mb-4">Points are converted to wallet credit at a rate of <strong>1 point = ₹1</strong>. Use your wallet balance during checkout to reduce order total.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="number" min={1} max={account.points} value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} placeholder={`Max ${account.points} points`} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="text" value={redeemDesc} onChange={(e) => setRedeemDesc(e.target.value)} placeholder="Note (optional)" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button onClick={handleRedeem} disabled={redeeming || !redeemPoints} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap">
                    {redeeming ? "Redeeming..." : `Redeem${redeemPoints ? ` for ₹${redeemPoints}` : ""}`}
                  </button>
                </div>
              </div>
            )}

            {/* Wallet Info */}
            {Number(account.walletBalance) > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-8 flex items-center gap-3">
                <Wallet size={20} className="text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Wallet balance: ₹{Number(account.walletBalance).toFixed(2)}</p>
                  <p className="text-sm text-green-700">Your wallet balance will be available as a credit during checkout.</p>
                </div>
              </div>
            )}

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
                    <tr><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Points</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Date</th></tr>
                  </thead>
                  <tbody>
                    {account.transactions.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{t.type}</td>
                        <td className="px-4 py-2 text-gray-600">{t.description || "-"}</td>
                        <td className={`px-4 py-2 text-right font-bold ${t.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {t.points > 0 ? `+${t.points}` : t.points}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{t.amount ? formatPrice(Number(t.amount)) : "-"}</td>
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