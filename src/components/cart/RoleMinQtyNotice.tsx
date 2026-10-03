import { Info } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface NoticeItem {
  quantity: number
  product: { title: string }
  metadata?: any
}

/**
 * Lines whose buyer role has a wholesale price for the product but hasn't reached its min
 * quantity yet. Those lines are billed at the retail price (the backend pricing engine decides
 * that); this only tells the buyer what buying more would get them.
 */
export function getRoleMinQtyHints(items: NoticeItem[]) {
  return items.flatMap((item) => {
    const p = item.metadata?.pricing
    if (!p || p.roleQtyReached !== false || p.roleDisplayPrice == null || p.roleMinQty == null) return []
    return [{ title: item.product.title, minQty: Number(p.roleMinQty), price: Number(p.roleDisplayPrice) }]
  })
}

export default function RoleMinQtyNotice({ items }: { items: NoticeItem[] }) {
  const hints = getRoleMinQtyHints(items)
  if (hints.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1.5" role="note">
      {hints.map((h) => (
        <p key={h.title} className="flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Buy {h.minQty} or more of <span className="font-medium">{h.title}</span> to buy at {formatPrice(h.price)}/unit
          </span>
        </p>
      ))}
    </div>
  )
}
