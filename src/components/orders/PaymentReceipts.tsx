"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Clock, FileText, Paperclip, Plus, Trash2, Wallet, X, XCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Receipt {
  id: string; amount: string | number; method: string; reference: string | null; receivedAt: string; note: string | null
  proofUrl: string | null; proofName: string | null; status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED"
  submittedVia: "ADMIN" | "CUSTOMER"; rejectReason: string | null; createdAt: string
}
interface Summary { total: number; paid: number; pendingVerification: number; balance: number; state: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"; hasReceipts: boolean }

const METHODS: { value: string; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank transfer (NEFT / RTGS / IMPS)" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
]
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label.split(" (")[0] || m
const STATE: Record<Summary["state"], { label: string; cls: string }> = {
  UNPAID: { label: "Unpaid", cls: "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40" },
  PARTIALLY_PAID: { label: "Partially paid", cls: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40" },
  PAID: { label: "Paid", cls: "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40" },
  OVERPAID: { label: "Overpaid", cls: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40" },
}
const inputCls = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/**
 * Part payments for an order. Admins record payments (counted at once) and verify / reject what customers send;
 * customers report a payment with proof, which waits for verification.
 */
export default function PaymentReceipts({ orderId, mode, orderStatus, onChange }: {
  orderId: string
  mode: "admin" | "customer"
  orderStatus: string
  onChange?: () => void
}) {
  const isAdmin = mode === "admin"
  const [summary, setSummary] = useState<Summary | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ amount: "", method: "BANK_TRANSFER", receivedAt: today(), reference: "", note: "" })
  const [proof, setProof] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const headers = (): Record<string, string> => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  const apply = (d: any) => { setSummary(d.summary); setReceipts(d.receipts || []) }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/receipts`, { headers: headers(), cache: "no-store" })
      const d = await res.json()
      if (res.ok) apply(d)
    } catch { /* the panel just stays empty */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => { load() }, [load])

  const call = async (key: string, url: string, init: RequestInit) => {
    setBusy(key)
    setError("")
    try {
      const res = await fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(Array.isArray(d.message) ? d.message.join(", ") : d.message || "Something went wrong")
      apply(d)
      onChange?.()
      return true
    } catch (e: any) {
      setError(e.message)
      return false
    } finally {
      setBusy(null)
    }
  }

  // Room for more payments, counted on receipts alone. A customer whose order is already paid (e.g. online) gets none.
  const room = !summary || (!isAdmin && !summary.hasReceipts && summary.state === "PAID") ? 0 : Math.max(0, Math.round((summary.total - (summary.hasReceipts ? summary.paid : 0) - (isAdmin ? 0 : summary.pendingVerification)) * 100) / 100)
  const closed = orderStatus === "CANCELLED"
  const canAdd = !closed && room > 0

  const openForm = () => {
    setForm({ amount: room ? String(room) : "", method: "BANK_TRANSFER", receivedAt: today(), reference: "", note: "" })
    setProof(null)
    setError("")
    setFormOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) { setError("Enter the amount paid"); return }
    if (amount > room + 0.005) { setError(`The amount can be at most ${formatPrice(room)}`); return }
    if (proof && proof.size > 5 * 1024 * 1024) { setError("The proof file must be 5 MB or smaller"); return }
    const fd = new FormData()
    fd.append("amount", String(amount))
    fd.append("method", form.method)
    fd.append("receivedAt", form.receivedAt)
    if (form.reference.trim()) fd.append("reference", form.reference.trim())
    if (form.note.trim()) fd.append("note", form.note.trim())
    if (proof) fd.append("proof", proof)
    if (await call("add", `/api/orders/${orderId}/receipts`, { method: "POST", body: fd })) setFormOpen(false)
  }

  if (!summary) return null
  const st = STATE[summary.state]
  const pct = summary.total > 0 ? Math.min(100, (summary.paid / summary.total) * 100) : 0

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5"><Wallet size={15} className="text-primary-600" /> Payments received</h3>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Order total" value={formatPrice(summary.total)} />
        <Stat label="Received" value={formatPrice(summary.paid)} tone="green" />
        {summary.pendingVerification > 0 && <Stat label="Awaiting verification" value={formatPrice(summary.pendingVerification)} tone="amber" />}
        <Stat label="Balance due" value={formatPrice(summary.balance)} tone={summary.balance > 0 ? "red" : undefined} />
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Share of the order paid">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {!summary.hasReceipts && summary.state === "PAID" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Marked as paid{isAdmin ? " (no part payments recorded). Recording a payment here switches this order to part-payment tracking." : "."}</p>
      )}

      {error && <p className="text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded-lg px-3 py-2">{error}</p>}

      {!formOpen && canAdd && (
        <button type="button" onClick={openForm} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          <Plus size={15} /> {isAdmin ? "Record payment" : "I've made a payment"}
        </button>
      )}
      {!isAdmin && !canAdd && !closed && summary.pendingVerification > 0 && summary.balance > 0 && (
        <p className="text-xs text-gray-500">Your payment is being verified. We will update this order once it is confirmed.</p>
      )}

      {formOpen && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{isAdmin ? "Record a payment" : "Tell us about your payment"}</p>
            <button type="button" onClick={() => setFormOpen(false)} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs text-gray-600 dark:text-gray-400">Amount (₹) *</span>
              <input type="number" min={0.01} step="0.01" max={room} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} required />
            </label>
            <label className="space-y-1"><span className="text-xs text-gray-600 dark:text-gray-400">Paid on *</span>
              <input type="date" value={form.receivedAt} max={today()} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} className={inputCls} required />
            </label>
          </div>
          <label className="block space-y-1"><span className="text-xs text-gray-600 dark:text-gray-400">Paid by *</span>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputCls}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1"><span className="text-xs text-gray-600 dark:text-gray-400">Reference (UTR / transaction ID / cheque no.)</span>
            <input value={form.reference} maxLength={100} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} />
          </label>
          <label className="block space-y-1"><span className="text-xs text-gray-600 dark:text-gray-400">Note</span>
            <textarea rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} />
          </label>
          <div className="space-y-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Proof of payment {isAdmin ? "(optional)" : "(screenshot, receipt or PDF — recommended)"}</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] || null)} />
            {proof ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
                <span className="flex items-center gap-1.5 min-w-0 text-xs text-gray-700 dark:text-gray-300"><Paperclip size={13} className="shrink-0" /><span className="truncate">{proof.name}</span></span>
                <button type="button" onClick={() => { setProof(null); if (fileRef.current) fileRef.current.value = "" }} className="text-gray-400 hover:text-red-600" aria-label="Remove file"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 px-3 py-3 text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600">
                <Paperclip size={14} className="inline mr-1" /> Attach proof — JPG, PNG, WEBP or PDF, up to 5 MB
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:bg-white dark:hover:bg-gray-800">Cancel</button>
            <button type="submit" disabled={busy === "add"} className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {busy === "add" ? "Saving…" : isAdmin ? "Save payment" : "Submit for verification"}
            </button>
          </div>
        </form>
      )}

      {receipts.length > 0 && (
        <ul className="space-y-2">
          {receipts.map((r) => (
            <li key={r.id} className={`rounded-xl border px-3 py-2.5 ${r.status === "REJECTED" ? "border-red-100 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10" : r.status === "PENDING_VERIFICATION" ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10" : "border-gray-100 dark:border-gray-800"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-bold ${r.status === "REJECTED" ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>{formatPrice(Number(r.amount))}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(r.receivedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {methodLabel(r.method)}
                    {r.reference ? <> · <span className="font-mono">{r.reference}</span></> : null}
                  </p>
                </div>
                <ReceiptBadge status={r.status} />
              </div>
              {r.note && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{r.note}</p>}
              {r.status === "REJECTED" && r.rejectReason && <p className="mt-1 text-xs text-red-700 dark:text-red-300">Not accepted: {r.rejectReason}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {r.proofUrl && (
                  <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline">
                    <FileText size={12} /> View proof
                  </a>
                )}
                <span className="text-gray-400">{r.submittedVia === "CUSTOMER" ? (isAdmin ? "Sent by customer" : "Sent by you") : "Recorded by us"}</span>
                <span className="ml-auto flex items-center gap-2">
                  {isAdmin && r.status === "PENDING_VERIFICATION" && (
                    <>
                      <button type="button" disabled={!!busy} onClick={() => call(r.id, `/api/orders/${orderId}/receipts/${r.id}/verify`, { method: "PATCH" })} className="font-semibold text-green-700 hover:underline disabled:opacity-50">Verify</button>
                      <button type="button" disabled={!!busy} onClick={() => setRejecting({ id: r.id, reason: "" })} className="font-semibold text-red-600 hover:underline disabled:opacity-50">Reject</button>
                    </>
                  )}
                  {(isAdmin || (r.submittedVia === "CUSTOMER" && r.status === "PENDING_VERIFICATION")) && (
                    confirmDelete === r.id ? (
                      <>
                        <button type="button" disabled={!!busy} onClick={async () => { await call(r.id, `/api/orders/${orderId}/receipts/${r.id}`, { method: "DELETE" }); setConfirmDelete(null) }} className="font-semibold text-red-600 hover:underline">{isAdmin ? "Delete" : "Withdraw"}?</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="text-gray-500 hover:underline">Keep</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(r.id)} className="text-gray-400 hover:text-red-600" aria-label={isAdmin ? "Delete payment" : "Withdraw payment"} title={isAdmin ? "Delete" : "Withdraw"}><Trash2 size={13} /></button>
                    )
                  )}
                </span>
              </div>
              {rejecting?.id === r.id && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ id: r.id, reason: e.target.value })} placeholder="Reason, e.g. amount not received in bank" className={`${inputCls} !py-1.5 text-xs`} />
                  <button type="button" disabled={!!busy || !rejecting.reason.trim()} onClick={async () => { if (await call(r.id, `/api/orders/${orderId}/receipts/${r.id}/reject`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: rejecting.reason }) })) setRejecting(null) }} className="shrink-0 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Reject</button>
                  <button type="button" onClick={() => setRejecting(null)} className="shrink-0 text-xs text-gray-500">Cancel</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "text-green-700 dark:text-green-400" : tone === "amber" ? "text-amber-700 dark:text-amber-400" : tone === "red" ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ReceiptBadge({ status }: { status: Receipt["status"] }) {
  if (status === "VERIFIED") return <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400"><CheckCircle2 size={13} /> Received</span>
  if (status === "REJECTED") return <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-600"><XCircle size={13} /> Rejected</span>
  return <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400"><Clock size={13} /> Awaiting verification</span>
}
