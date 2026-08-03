"use client"

import { useState } from "react"
import { X, Smartphone, Landmark, CheckCircle2, Info, CreditCard, ShieldCheck } from "lucide-react"
import { PaymentOffer, getPaymentOfferBadge, formatUpiApp, calcOfferDiscount } from "@/lib/pricing"

const BADGE_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-orange-600",
]

function colorFor(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]
}

function initialsFor(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase()
}

/** Stylized bank/UPI "logo" — a deterministic colored initials badge. No trademarked
 *  logo imagery is used since offers are admin-authored free text, not verified brand assets. */
export function BankLogo({ offer, size = "md" }: { offer: PaymentOffer; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-9 h-9 text-[10px]" : "w-11 h-11 text-xs"
  if (offer.offerType === "UPI") {
    return (
      <div className={`${dim} rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0`}>
        <Smartphone size={size === "sm" ? 15 : 18} />
      </div>
    )
  }
  const label = offer.bankName || "Bank"
  return (
    <div className={`${dim} rounded-xl ${colorFor(label)} text-white font-extrabold flex items-center justify-center flex-shrink-0 tracking-tight`}>
      {initialsFor(label)}
    </div>
  )
}

interface BankOfferCardProps {
  offer: PaymentOffer
  selectable?: boolean
  selected?: boolean
  /** Selectable + not yet applied: card click opens the verification modal (see OfferVerifyModal below). */
  onApply?: () => void
  /** Selectable + already applied: dedicated Remove action, no re-verification needed to undo. */
  onRemove?: () => void
  ineligibleReason?: string
}

export function BankOfferCard({ offer, selectable, selected, onApply, onRemove, ineligibleReason }: BankOfferCardProps) {
  const ineligible = !!ineligibleReason
  const sourceLabel = offer.offerType === "BANK" ? (offer.bankName || "Bank Offer") : formatUpiApp(offer.upiApp)
  const canOpenModal = selectable && !ineligible && !selected

  return (
    <div
      onClick={canOpenModal ? onApply : undefined}
      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
        ineligible
          ? "border-gray-100 bg-gray-50/60 opacity-70"
          : selected
          ? "border-primary-400 bg-primary-50/60 shadow-sm"
          : "border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm"
      } ${canOpenModal ? "cursor-pointer" : ""}`}
    >
      <BankLogo offer={offer} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-900">{sourceLabel}</p>
          <span className={`badge flex-shrink-0 ${ineligible ? "bg-gray-100 text-gray-500" : "badge-success"}`}>{getPaymentOfferBadge(offer)}</span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{offer.description || offer.name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-400">
          {offer.maxDiscount != null && (
            <span>Max discount: <span className="font-semibold text-gray-600">₹{Number(offer.maxDiscount).toLocaleString("en-IN")}</span></span>
          )}
          {offer.minOrderValue != null && (
            <span>Min order: <span className="font-semibold text-gray-600">₹{Number(offer.minOrderValue).toLocaleString("en-IN")}</span></span>
          )}
          {offer.cardType && offer.cardType !== "BOTH" && offer.offerType === "BANK" && (
            <span className="capitalize">{offer.cardType.toLowerCase()} card only</span>
          )}
        </div>
        {ineligible ? (
          <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600 mt-2">
            <Info size={12} className="flex-shrink-0" /> {ineligibleReason}
          </p>
        ) : selectable ? (
          selected ? (
            <div className="flex items-center justify-between mt-2">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-primary-700">
                <CheckCircle2 size={12} className="flex-shrink-0" /> Applied to this order
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove?.() }}
                className="text-[11px] font-semibold text-gray-400 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-1 text-[11px] font-semibold mt-2 text-gray-400">
              <CheckCircle2 size={12} className="flex-shrink-0" /> Tap to apply
            </p>
          )
        ) : null}
      </div>
    </div>
  )
}

export function BankOffersModal({ offers, onClose }: { offers: PaymentOffer[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[85vh] flex flex-col shadow-[var(--shadow-elevated)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-primary-600" />
            <h3 className="font-bold text-gray-900">All Bank &amp; UPI Offers</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {offers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No offers available right now.</p>
          ) : (
            offers.map((offer) => (
              <div key={offer.id}>
                <BankOfferCard offer={offer} />
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                  Valid till {new Date(offer.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Terms &amp; conditions apply.
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

const UPI_APPS = [
  { key: "GOOGLE_PAY", label: "Google Pay" },
  { key: "PHONEPE", label: "PhonePe" },
  { key: "PAYTM", label: "Paytm" },
  { key: "BHIM", label: "BHIM" },
] as const

const UPI_ID_REGEX = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/

interface OfferVerifyModalProps {
  offer: PaymentOffer
  /** Pre-computed via the existing calcOfferDiscount() so the number shown here always matches order-summary math. */
  discountAmount: number
  onClose: () => void
  /** Fires only once validation passes — parent applies the (unchanged) existing discount logic. */
  onApplied: () => void
}

/**
 * Lightweight eligibility-verification step shown before a bank/UPI offer is
 * applied. This does NOT collect a full card number, expiry, or CVV, and
 * nothing entered here is sent to any API or stored anywhere — it only
 * gates when the existing `onApplied` (selection) callback fires. The real
 * payment still happens entirely through Razorpay afterwards.
 */
export function OfferVerifyModal({ offer, discountAmount, onClose, onApplied }: OfferVerifyModalProps) {
  const isBank = offer.offerType === "BANK"
  const sourceLabel = isBank ? (offer.bankName || "Bank Offer") : formatUpiApp(offer.upiApp)
  const lockedCardType = isBank && offer.cardType && offer.cardType !== "BOTH" ? offer.cardType : null
  const lockedUpiApp = !isBank && offer.upiApp ? offer.upiApp : null

  const [cardType, setCardType] = useState<"CREDIT" | "DEBIT" | null>(null)
  const [last4, setLast4] = useState("")
  const [upiApp, setUpiApp] = useState<string | null>(null)
  const [upiId, setUpiId] = useState("")
  const [touched, setTouched] = useState(false)

  const last4Valid = /^\d{4}$/.test(last4)
  const upiIdValid = upiId.length > 0 && UPI_ID_REGEX.test(upiId)
  const upiSatisfied = !!upiApp || upiIdValid

  const canSubmit = isBank ? !!cardType && last4Valid : upiSatisfied

  const handleSubmit = () => {
    setTouched(true)
    if (!canSubmit) return
    onApplied()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl max-h-[90vh] flex flex-col shadow-[var(--shadow-elevated)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BankLogo offer={offer} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{sourceLabel}</p>
              <p className="text-xs text-gray-400">Verify to apply this offer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex-shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Offer summary */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-primary-50/60 border border-primary-100">
            <div>
              <p className="text-sm font-bold text-primary-900">{getPaymentOfferBadge(offer)}</p>
              {offer.maxDiscount != null && (
                <p className="text-xs text-primary-600">Max discount ₹{Number(offer.maxDiscount).toLocaleString("en-IN")}</p>
              )}
            </div>
            <span className="badge-success flex items-center gap-1 flex-shrink-0"><CheckCircle2 size={12} /> Eligible</span>
          </div>

          {isBank ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Card Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["CREDIT", "DEBIT"] as const).map((t) => {
                    const disabled = !!lockedCardType && lockedCardType !== t
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={disabled}
                        onClick={() => setCardType(t)}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                          cardType === t
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : disabled
                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                            : "border-gray-200 text-gray-600 hover:border-primary-300"
                        }`}
                      >
                        {t === "CREDIT" ? "Credit Card" : "Debit Card"}
                      </button>
                    )
                  })}
                </div>
                {lockedCardType && (
                  <p className="text-[11px] text-gray-400 mt-1.5">This offer applies to {lockedCardType.toLowerCase()} cards only</p>
                )}
                {touched && !cardType && <p className="text-xs text-red-500 mt-1">Select a card type</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bank Name</label>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-600">
                  <Landmark size={14} className="text-gray-400 flex-shrink-0" /> {offer.bankName || "Any Bank"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last 4 Digits of Card Number</label>
                <div className="relative">
                  <CreditCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="1234"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
                      touched && !last4Valid ? "border-red-300" : "border-gray-200"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Only the last 4 digits, for eligibility verification — never your full card number, expiry, or CVV.</p>
                {touched && !last4Valid && <p className="text-xs text-red-500 mt-1">Enter exactly 4 digits</p>}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">UPI App</label>
                <div className="grid grid-cols-2 gap-2">
                  {UPI_APPS.map((app) => {
                    const disabled = !!lockedUpiApp && lockedUpiApp !== app.key
                    const active = upiApp === app.key
                    return (
                      <button
                        key={app.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => { setUpiApp(app.key); setUpiId("") }}
                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                          active
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : disabled
                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                            : "border-gray-200 text-gray-600 hover:border-primary-300"
                        }`}
                      >
                        <Smartphone size={14} className="flex-shrink-0" /> {app.label}
                      </button>
                    )
                  })}
                </div>
                {lockedUpiApp && (
                  <p className="text-[11px] text-gray-400 mt-1.5">This offer applies to {formatUpiApp(lockedUpiApp)} only</p>
                )}
              </div>

              {!lockedUpiApp && (
                <>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold uppercase tracking-wide">
                    <div className="h-px bg-gray-100 flex-1" /> or <div className="h-px bg-gray-100 flex-1" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">UPI ID</label>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="yourname@okhdfcbank"
                      value={upiId}
                      onChange={(e) => { setUpiId(e.target.value.trim()); setUpiApp(null) }}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
                        touched && upiId.length > 0 && !upiIdValid ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {upiId.length > 0 && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${upiIdValid ? "text-green-600" : "text-red-500"}`}>
                        {upiIdValid ? <CheckCircle2 size={12} /> : <Info size={12} />}
                        {upiIdValid ? "Valid UPI ID format" : "Enter a valid UPI ID, e.g. name@bank"}
                      </p>
                    )}
                  </div>
                </>
              )}

              {touched && !upiSatisfied && <p className="text-xs text-red-500">Select a UPI app or enter a valid UPI ID</p>}
            </>
          )}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-green-50 border border-green-100">
              <span className="text-sm font-semibold text-green-800">You&apos;ll save</span>
              <span className="text-base font-extrabold text-green-700">₹{discountAmount.toLocaleString("en-IN")}</span>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-gray-400 leading-relaxed">
            <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
            This only verifies offer eligibility. Your actual payment is still processed securely through Razorpay.
          </p>
        </div>

        <div className="p-5 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={handleSubmit} className="btn-primary w-full justify-center">
            Apply Offer
          </button>
        </div>
      </div>
    </div>
  )
}
