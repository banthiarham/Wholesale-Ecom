"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import {
  BookOpen, ShoppingBag, CreditCard, RotateCcw, RefreshCcw, Wallet, Search, X, Download, FileSpreadsheet, ExternalLink, Filter,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

type LedgerSource = "ORDER" | "PAYMENT" | "RETURN" | "REFUND" | "WALLET"
type Direction = "DEBIT" | "CREDIT"

interface LedgerEntry {
  id: string
  source: LedgerSource
  date: string
  description: string
  amount: number
  direction: Direction
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

interface Customer { id: string; firstName: string; lastName: string; email: string; phone?: string | null; companyName?: string | null }

const SOURCES: LedgerSource[] = ["ORDER", "PAYMENT", "RETURN", "REFUND", "WALLET"]
const SOURCE_META: Record<LedgerSource, { label: string; icon: any; color: string }> = {
  ORDER: { label: "Order", icon: ShoppingBag, color: "bg-primary-50 text-primary-700 border-primary-100 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800" },
  PAYMENT: { label: "Payment", icon: CreditCard, color: "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800" },
  RETURN: { label: "Return", icon: RotateCcw, color: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" },
  REFUND: { label: "Refund", icon: RefreshCcw, color: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" },
  WALLET: { label: "Wallet", icon: Wallet, color: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800" },
}

const inputCls = "px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
const customerName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim()
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
const round2 = (n: number) => Math.round(n * 100) / 100

export default function AdminLedgerPage() {
  return (
    <Suspense fallback={null}>
      <AdminLedger />
    </Suspense>
  )
}

function AdminLedger() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""
  const auth = { Authorization: `Bearer ${token}` }

  // ── Customer picker ──
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // ── Filters ──
  const [sources, setSources] = useState<LedgerSource[]>([])
  const [direction, setDirection] = useState<"" | Direction>("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [text, setText] = useState("")

  // ── Data ──
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Open straight on a customer: /admin/ledger?userId=…
  useEffect(() => {
    const id = searchParams.get("userId")
    if (!id || customer?.id === id) return
    fetch(`/api/users/${id}`, { headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (u?.id) setCustomer({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, companyName: u.companyName }) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Customer search (debounced).
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      fetch(`/api/users?search=${encodeURIComponent(query)}&take=10`, { headers: auth })
        .then((r) => r.json())
        .then((d) => setHits(d.users || []))
        .catch(() => setHits([]))
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const pick = (c: Customer) => {
    setCustomer(c)
    setOpen(false)
    setQuery("")
    router.replace(`/admin/ledger?userId=${c.id}`, { scroll: false })
  }

  const clearCustomer = () => {
    setCustomer(null)
    setSummary(null)
    setEntries([])
    router.replace("/admin/ledger", { scroll: false })
  }

  // Source + date filters run on the server; direction and text search run on the loaded rows.
  const load = useCallback(() => {
    if (!customer) return
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString())
    if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString())
    if (sources.length) params.set("sources", sources.join(","))
    fetch(`/api/ledger/${customer.id}?${params.toString()}`, { headers: auth })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.message || "Failed to load the ledger")
        setSummary(d.summary || null)
        setEntries(d.entries || [])
      })
      .catch((e) => { setError(e.message); setSummary(null); setEntries([]) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, from, to, sources])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase()
    return entries.filter((e) =>
      (!direction || e.direction === direction) &&
      (!q || e.description.toLowerCase().includes(q) || e.status.toLowerCase().includes(q) || e.referenceId.toLowerCase().includes(q)),
    )
  }, [entries, direction, text])

  const totals = useMemo(() => {
    const debit = round2(shown.filter((e) => e.direction === "DEBIT").reduce((s, e) => s + e.amount, 0))
    const credit = round2(shown.filter((e) => e.direction === "CREDIT").reduce((s, e) => s + e.amount, 0))
    return { debit, credit, net: round2(debit - credit) }
  }, [shown])

  const toggleSource = (s: LedgerSource) => setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const hasFilters = sources.length > 0 || !!direction || !!from || !!to || !!text.trim()
  const resetFilters = () => { setSources([]); setDirection(""); setFrom(""); setTo(""); setText("") }

  // ── Export ──
  const exportRows = () =>
    // Oldest first reads like a statement.
    [...shown].reverse().map((e) => ({
      Date: fmtDate(e.date),
      Type: SOURCE_META[e.source].label,
      Description: e.description,
      Status: e.status.replace(/_/g, " "),
      Debit: e.direction === "DEBIT" ? round2(e.amount) : "",
      Credit: e.direction === "CREDIT" ? round2(e.amount) : "",
      "Wallet Balance": e.runningBalance != null ? round2(e.runningBalance) : "",
      Reference: e.referenceId,
    }))

  const fileBase = () => {
    const name = customer ? customerName(customer).replace(/[^\w-]+/g, "_") : "customer"
    const period = from || to ? `_${from || "start"}_to_${to || "today"}` : ""
    return `ledger_${name}${period}`
  }

  const headerLines = (): (string | number)[][] => [
    ["Ledger", customer ? `${customerName(customer)} (${customer.email})` : ""],
    ...(customer?.companyName ? [["Company", customer.companyName]] : []),
    ["Period", from || to ? `${from ? fmtDate(from) : "Start"} – ${to ? fmtDate(to) : "Today"}` : "All time"],
    ["Filters", [sources.length ? sources.map((s) => SOURCE_META[s].label).join(", ") : "All types", direction ? `${direction.toLowerCase()} only` : "", text.trim() ? `search "${text.trim()}"` : ""].filter(Boolean).join(" · ")],
    ["Exported", new Date().toLocaleString("en-IN")],
    [],
  ]

  const exportExcel = () => {
    const rows = exportRows()
    const ws = XLSX.utils.aoa_to_sheet(headerLines())
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1 })
    XLSX.utils.sheet_add_aoa(ws, [[], ["", "", "Total", "", totals.debit, totals.credit], ["", "", "Net (Debit − Credit)", "", totals.net]], { origin: -1 })
    ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 50 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 38 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Ledger")
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase()}.xlsx`)
  }

  const exportCsv = () => {
    const rows = exportRows()
    const ws = XLSX.utils.aoa_to_sheet(headerLines())
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1 })
    XLSX.utils.sheet_add_aoa(ws, [[], ["", "", "Total", "", totals.debit, totals.credit], ["", "", "Net (Debit - Credit)", "", totals.net]], { origin: -1 })
    // BOM so Excel opens the ₹ / – characters correctly.
    saveAs(new Blob(["﻿" + XLSX.utils.sheet_to_csv(ws)], { type: "text/csv;charset=utf-8" }), `${fileBase()}.csv`)
  }

  const exportDisabled = !customer || shown.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><BookOpen size={20} className="text-primary-600" /> Ledger</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">A customer&apos;s orders, payments, returns, refunds and wallet activity in one statement.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exportDisabled} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          <button onClick={exportCsv} disabled={exportDisabled} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Customer */}
      <div className="admin-card-static p-5 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer</p>
        {customer ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{customerName(customer)}</p>
              <p className="text-gray-500 dark:text-gray-400 truncate">{customer.email}{customer.companyName ? ` · ${customer.companyName}` : ""}{customer.phone ? ` · ${customer.phone}` : ""}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link href={`/admin/users/${customer.id}`} className="p-1.5 text-gray-400 hover:text-primary-600" title="Open user"><ExternalLink size={16} /></Link>
              <button type="button" onClick={clearCustomer} className="p-1.5 text-gray-400 hover:text-red-600" title="Change customer"><X size={16} /></button>
            </div>
          </div>
        ) : (
          <div ref={pickerRef} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              placeholder="Search a user by name, email, phone or company..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              className={`${inputCls} w-full pl-9`}
            />
            {open && (
              <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                {hits.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No users found</li>}
                {hits.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pick(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{customerName(c)}</span>
                      <span className="text-gray-500"> · {c.email}{c.companyName ? ` · ${c.companyName}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {!customer ? (
        <div className="admin-card-static p-10 text-center">
          <BookOpen className="mx-auto text-gray-300 dark:text-gray-600" size={36} />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Select a user to see their ledger.</p>
        </div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Tile label="Orders" value={`${summary.totalOrders} · ${formatPrice(summary.totalOrderValue)}`} />
              <Tile label="Payments received" value={formatPrice(summary.paymentsMade)} />
              <Tile label="Pending amount" value={formatPrice(summary.pendingAmount)} tone={summary.pendingAmount > 0 ? "warn" : undefined} />
              <Tile label="Returns" value={`${summary.returnsCount} · ${formatPrice(summary.returnsAmount)}`} />
              <Tile label="Refunds" value={formatPrice(summary.refundsTotal)} />
              <Tile label="Wallet balance" value={formatPrice(summary.walletBalance)} sub={summary.creditLimit > 0 ? `Credit ${formatPrice(summary.availableCredit)} of ${formatPrice(summary.creditLimit)}` : undefined} />
            </div>
          )}

          {/* Filters */}
          <div className="admin-card-static p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 mr-1"><Filter size={14} /> Type</span>
              <Chip active={sources.length === 0} onClick={() => setSources([])}>All</Chip>
              {SOURCES.map((s) => <Chip key={s} active={sources.includes(s)} onClick={() => toggleSource(s)}>{SOURCE_META[s].label}</Chip>)}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <span className="block">From</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <span className="block">To</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <span className="block">Debit / Credit</span>
                <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className={inputCls}>
                  <option value="">Both</option>
                  <option value="DEBIT">Debit only</option>
                  <option value="CREDIT">Credit only</option>
                </select>
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400 space-y-1 flex-1 min-w-[12rem]">
                <span className="block">Search</span>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Order no., description or status" className={`${inputCls} w-full`} />
              </label>
              {hasFilters && (
                <button type="button" onClick={resetFilters} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600">Clear filters</button>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          <div className={`admin-card-static overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{shown.length} {shown.length === 1 ? "entry" : "entries"}{loading ? " · loading…" : ""}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-gray-600 dark:text-gray-400">Debit <b className="text-gray-900 dark:text-gray-100">{formatPrice(totals.debit)}</b></span>
                <span className="text-gray-600 dark:text-gray-400">Credit <b className="text-green-600">{formatPrice(totals.credit)}</b></span>
                <span className="text-gray-600 dark:text-gray-400">Net <b className="text-gray-900 dark:text-gray-100">{formatPrice(totals.net)}</b></span>
              </span>
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{loading ? "Loading…" : hasFilters ? "No entries match these filters." : "No transactions for this user yet."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Date</th>
                      <th className="px-4 py-2.5 text-left font-medium">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium">Description</th>
                      <th className="px-4 py-2.5 text-left font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                      <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                      <th className="px-4 py-2.5 text-right font-medium">Wallet balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {shown.map((e) => {
                      const meta = SOURCE_META[e.source]
                      const Icon = meta.icon
                      const linksToOrder = e.source !== "WALLET"
                      return (
                        <tr key={e.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">{fmtDate(e.date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}><Icon size={12} /> {meta.label}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                            {linksToOrder ? <Link href={`/admin/orders/${e.referenceId}`} className="hover:text-primary-600 hover:underline">{e.description}</Link> : e.description}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.status.replace(/_/g, " ")}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">{e.direction === "DEBIT" ? formatPrice(e.amount) : ""}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium text-green-600">{e.direction === "CREDIT" ? formatPrice(e.amount) : ""}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-500 dark:text-gray-400">{e.runningBalance != null ? formatPrice(e.runningBalance) : "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300"
      }`}
    >
      {children}
    </button>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="admin-card-static p-4">
      <p className={`text-sm sm:text-base font-bold leading-tight break-words ${tone === "warn" ? "text-amber-600" : "text-gray-900 dark:text-gray-100"}`}>{value}</p>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
