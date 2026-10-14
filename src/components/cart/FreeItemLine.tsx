import Link from "next/link"
import Image from "next/image"
import { Gift, Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { freeQuantityFor, type FreeLine } from "@/lib/freeItems"

/**
 * One free item earned by a paid product, shown as a compact read-only detail row under it.
 * The count follows the paid quantity (recomputed from the offer), so it updates as the
 * shopper edits the quantity. There is deliberately no quantity control or remove button.
 */
export default function FreeItemLine({ line, paidQuantity, onNavigate }: { line: FreeLine; paidQuantity: number; onNavigate?: () => void }) {
  const n = freeQuantityFor(line, paidQuantity)
  if (n <= 0) return null
  const body = (
    <>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-pink-100 bg-white">
        {line.thumbnail ? (
          <Image src={line.thumbnail} alt={line.title} width={36} height={36} className="h-full w-full object-cover" />
        ) : (
          <Package size={16} className="text-pink-300" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-gray-900">{line.title}</span>
        <span className="block text-[11px] text-pink-700">
          <Gift size={10} className="mr-1 inline -mt-0.5" />
          {line.ruleName} · Qty {n}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xs font-bold uppercase tracking-wide text-pink-700">Free</span>
        {line.worth > 0 && <span className="block text-[11px] text-gray-400 line-through">{formatPrice(line.worth * n)}</span>}
      </span>
    </>
  )
  const cls = "mt-2 flex items-center gap-2.5 rounded-xl border border-pink-100 bg-pink-50/70 px-2.5 py-2"
  return line.handle ? (
    <Link href={`/products/${line.handle}`} onClick={onNavigate} className={cls + " hover:bg-pink-50 transition-colors"}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
