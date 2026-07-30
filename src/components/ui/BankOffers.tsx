"use client"

import { X, Smartphone, Landmark, CheckCircle2, Info } from "lucide-react"
import { PaymentOffer, getPaymentOfferBadge, formatUpiApp } from "@/lib/pricing"

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
  onSelect?: () => void
  ineligibleReason?: string
}

export function BankOfferCard({ offer, selectable, selected, onSelect, ineligibleReason }: BankOfferCardProps) {
  const ineligible = !!ineligibleReason
  const sourceLabel = offer.offerType === "BANK" ? (offer.bankName || "Bank Offer") : formatUpiApp(offer.upiApp)

  return (
    <div
      onClick={selectable && !ineligible ? onSelect : undefined}
      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
        ineligible
          ? "border-gray-100 bg-gray-50/60 opacity-70"
          : selected
          ? "border-primary-400 bg-primary-50/60 shadow-sm"
          : "border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm"
      } ${selectable && !ineligible ? "cursor-pointer" : ""}`}
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
          <p className={`flex items-center gap-1 text-[11px] font-semibold mt-2 ${selected ? "text-primary-700" : "text-gray-400"}`}>
            <CheckCircle2 size={12} className="flex-shrink-0" /> {selected ? "Applied to this order" : "Tap to apply"}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function BankOffersModal({ offers, onClose }: { offers: PaymentOffer[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[85vh] flex flex-col animate-fade-in-up"
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
