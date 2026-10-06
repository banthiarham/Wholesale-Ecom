"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Copy, Landmark } from "lucide-react"

export interface BankAccount {
  id: string
  settings?: Record<string, string> | null
}

const ROWS: { key: string; label: string; copy?: boolean }[] = [
  { key: "bankName", label: "Bank Name" },
  { key: "accountName", label: "Account Name" },
  { key: "accountNumber", label: "Account Number", copy: true },
  { key: "ifscCode", label: "IFSC Code", copy: true },
  { key: "branch", label: "Branch" },
]

/** Bank accounts that admins enabled under Payment Gateways → Bank Transfer. */
export async function fetchBankAccounts(): Promise<BankAccount[]> {
  try {
    const res = await fetch("/api/payment-gateways/enabled", { cache: "no-store" })
    const data = await res.json()
    const list: { id: string; provider: string; settings?: Record<string, string> | null }[] = Array.isArray(data) ? data : data.gateways ?? []
    return list.filter((g) => g.provider === "BANK_TRANSFER").map((g) => ({ id: g.id, settings: g.settings }))
  } catch {
    return []
  }
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) } catch { /* clipboard blocked */ }
      }}
      className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition shrink-0"
    >
      {done ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  )
}

/** The five details of one account, read-only. */
export function BankAccountCard({ account, title }: { account: BankAccount; title?: string }) {
  const s = account.settings || {}
  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {title && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/70 rounded-t-xl">
          <Landmark size={15} className="text-primary-600" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
      )}
      <dl className="divide-y divide-gray-100 text-sm">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="text-gray-500 shrink-0">{r.label}</dt>
            <dd className="font-semibold text-gray-900 text-right break-all flex items-center justify-end">
              <span className="select-all">{s[r.key] || "—"}</span>
              {r.copy && s[r.key] ? <CopyButton value={s[r.key]} /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** One account at a time: swipe, or use the arrows, to move between accounts. */
export function BankAccountsCarousel({ accounts }: { accounts: BankAccount[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const many = accounts.length > 1

  const go = useCallback((i: number) => {
    const el = scroller.current
    if (!el) return
    const next = Math.max(0, Math.min(accounts.length - 1, i))
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" })
    setIndex(next)
  }, [accounts.length])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div>
      {many && (
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous bank account" className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-semibold text-gray-500">Account {index + 1} of {accounts.length}</span>
          <button type="button" onClick={() => go(index + 1)} disabled={index === accounts.length - 1} aria-label="Next bank account" className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      <div ref={scroller} className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {accounts.map((a, i) => (
          <div key={a.id} className="min-w-full snap-center px-0.5">
            <BankAccountCard account={a} title={many ? `Bank Account ${i + 1}` : undefined} />
          </div>
        ))}
      </div>
      {many && (
        <div className="flex justify-center gap-1.5 mt-3" aria-hidden>
          {accounts.map((a, i) => (
            <span key={a.id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-primary-600" : "w-1.5 bg-gray-300"}`} />
          ))}
        </div>
      )}
    </div>
  )
}
