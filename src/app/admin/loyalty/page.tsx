"use client"

import { useEffect, useState } from "react"
import { Award, Plus, X, Zap, ExternalLink } from "lucide-react"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface LoyaltyAccount {
  id: string
  userId: string
  points: number
  tier: string
  lifetimePoints: number
  walletBalance: number
  user?: { id: string; firstName: string; lastName: string; email: string }
}

interface EarningRule {
  id: string
  name: string
  type: string
  description: string | null
  actions: Record<string, any>
  conditions: Record<string, any>
}

export default function AdminLoyaltyPage() {
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showEarn, setShowEarn] = useState(false)
  const [showCashback, setShowCashback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [form, setForm] = useState({ userId: "", points: "", description: "" })
  const [cbForm, setCbForm] = useState({ userId: "", amount: "", description: "" })
  const [search, setSearch] = useState("")
  const [earningRules, setEarningRules] = useState<EarningRule[]>([])

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  useEffect(() => { loadLeaderboard(); loadUsers(); loadEarningRules() }, [token])

  const loadEarningRules = async () => {
    try {
      const loyaltyTypes = "LOYALTY_ORDER_EARN,LOYALTY_CATEGORY_BONUS,LOYALTY_FIRST_ORDER_BONUS,LOYALTY_REVIEW_BONUS,LOYALTY_REFERRAL_BONUS"
      const res = await fetch(`/api/rules?isActive=true`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const allRules = data.rules ?? []
      setEarningRules(allRules.filter((r: any) => r.type.startsWith("LOYALTY_")))
    } catch (e) { console.error(e) }
  }

  const formatRuleAction = (rule: EarningRule) => {
    const a = rule.actions || {}
    switch (rule.type) {
      case "LOYALTY_ORDER_EARN": return `${a.pointsPerUnit || "?"} pts per ₹${a.unitAmount || "?"}`
      case "LOYALTY_CATEGORY_BONUS": return `${a.bonusPoints || "?"} bonus pts`
      case "LOYALTY_FIRST_ORDER_BONUS": return `${a.bonusPoints || "?"} bonus pts`
      case "LOYALTY_REVIEW_BONUS": return `${a.bonusPoints || "?"} bonus pts`
      case "LOYALTY_REFERRAL_BONUS": return `${a.referrerPoints || "?"} pts (referrer)`
      default: return ""
    }
  }

  const loadLeaderboard = async () => {
    setLoading(true)
    try { const res = await fetch("/api/loyalty/leaderboard", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setAccounts(Array.isArray(data) ? data : data.accounts ?? data.leaderboard ?? []) } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  const loadUsers = async () => { try { const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setUsers(data.users ?? []) } catch (e) { console.error(e) } }

  const handleEarn = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const t = localStorage.getItem("token")!
    try { const res = await fetch("/api/loyalty/earn", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ userId: form.userId, points: Number(form.points), description: form.description }) }); if (res.ok) { setShowEarn(false); setForm({ userId: "", points: "", description: "" }); loadLeaderboard() } else { const d = await res.json(); alert(d.message || "Failed to add points") } } catch (e) { alert("Failed to add points") } finally { setSaving(false) }
  }

  const handleCashback = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const t = localStorage.getItem("token")!
    try { const res = await fetch("/api/loyalty/cashback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ userId: cbForm.userId, amount: Number(cbForm.amount), description: cbForm.description }) }); if (res.ok) { setShowCashback(false); setCbForm({ userId: "", amount: "", description: "" }); loadLeaderboard() } else { const d = await res.json(); alert(d.message || "Failed to add cashback") } } catch (e) { alert("Failed to add cashback") } finally { setSaving(false) }
  }

  const tierBadge = (tier: string) => {
    const colors: Record<string, string> = { bronze: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800", silver: "bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700", gold: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800", platinum: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800" }
    return colors[tier?.toLowerCase()] || "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700"
  }

  const filtered = accounts.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.user?.firstName?.toLowerCase().includes(q) || a.user?.lastName?.toLowerCase().includes(q) || a.user?.email?.toLowerCase().includes(q)
  })

  if (loading) return <SkeletonTable />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Loyalty Program</h1><div className="flex gap-3"><button onClick={() => setShowEarn(true)} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"><Plus size={16} /> Add Points</button><button onClick={() => setShowCashback(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"><Plus size={16} /> Add Cashback</button></div></div>

      <div className="relative"><input type="text" placeholder="Search by user name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" /></div>

      {/* Earning Rules */}
      {earningRules.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold">Active Earning Rules</h2>
            </div>
            <a href="/admin/rules" className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-400">
              Manage Rules <ExternalLink size={14} />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {earningRules.map((rule) => (
              <div key={rule.id} className="p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{rule.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatRuleAction(rule)}</div>
                {rule.description && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{rule.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Points Modal */}
      {showEarn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Add Points</h3><button onClick={() => setShowEarn(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button></div>
            <form onSubmit={handleEarn} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label><select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"><option value="">Select user...</option>{users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points</label><input required type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label><input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Reason for adding points" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div className="flex gap-3"><button type="button" onClick={() => setShowEarn(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button><button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Adding..." : "Add Points"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Cashback Modal */}
      {showCashback && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Add Cashback</h3><button onClick={() => setShowCashback(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={20} /></button></div>
            <form onSubmit={handleCashback} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label><select required value={cbForm.userId} onChange={(e) => setCbForm({ ...cbForm, userId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"><option value="">Select user...</option>{users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label><input required type="number" step="0.01" value={cbForm.amount} onChange={(e) => setCbForm({ ...cbForm, amount: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label><input required value={cbForm.description} onChange={(e) => setCbForm({ ...cbForm, description: e.target.value })} placeholder="Reason for cashback" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100" /></div>
              <div className="flex gap-3"><button type="button" onClick={() => setShowCashback(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">Cancel</button><button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? "Adding..." : "Add Cashback"}</button></div>
            </form>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center"><Award size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" /><p className="text-gray-600 dark:text-gray-400">No loyalty accounts found.</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Rank</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">User</th><th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Tier</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Points</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Lifetime</th><th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Wallet</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((a, i) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3"><span className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center">{i + 1}</span></td>
                  <td className="px-4 py-3"><p className="font-medium text-gray-900 dark:text-gray-100">{a.user?.firstName} {a.user?.lastName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{a.user?.email}</p></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${tierBadge(a.tier)}`}>{(a.tier || "bronze").charAt(0).toUpperCase() + (a.tier || "bronze").slice(1)}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{a.points?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{a.lifetimePoints?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">₹{a.walletBalance?.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}