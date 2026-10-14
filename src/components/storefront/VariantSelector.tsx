"use client"

export interface VariantOption {
  name: string
  values: string[]
}

export interface ProductVariantInfo {
  id: string
  sku: string
  options: Record<string, string>
  price: number | string
  inventoryQuantity: number
  reservedQuantity: number
  /** The variant's own gallery (first = main). Empty means: fall back to the product's images. */
  images?: string[] | null
  image: string | null
  isActive: boolean
}

/** Images to show for a variant: its own gallery (or its single image), else none. */
export const variantImages = (v: ProductVariantInfo | null | undefined): string[] =>
  v ? (v.images && v.images.length ? v.images : v.image ? [v.image] : []) : []

export const variantStock = (v: ProductVariantInfo) => Math.max(0, v.inventoryQuantity - v.reservedQuantity)

/** First variant to show: the one named in the URL, else the first in stock, else the first active one. */
export function pickInitialVariant(variants: ProductVariantInfo[], preferredId?: string | null) {
  const active = variants.filter((v) => v.isActive)
  return (
    active.find((v) => v.id === preferredId) ||
    active.find((v) => variantStock(v) > 0) ||
    active[0] ||
    null
  )
}

const isColorOption = (name: string) => /colou?r|shade/i.test(name)
const cssColor = (value: string) =>
  typeof window !== "undefined" && typeof CSS !== "undefined" && CSS.supports?.("color", value.replace(/\s+/g, "")) ? value.replace(/\s+/g, "") : null

/**
 * Option pickers for a product with variants. Each option shows its values; picking a value moves
 * to the variant with that value that best keeps the other current choices. Values that no active
 * variant has are disabled, and values whose combination is out of stock are shown struck through.
 */
export default function VariantSelector({
  options,
  variants,
  selectedId,
  onSelect,
}: {
  options: VariantOption[]
  variants: ProductVariantInfo[]
  selectedId: string | null
  onSelect: (variantId: string) => void
}) {
  const active = variants.filter((v) => v.isActive)
  const selected = active.find((v) => v.id === selectedId) || null

  const choose = (optionName: string, value: string) => {
    const candidates = active.filter((v) => v.options[optionName] === value)
    if (candidates.length === 0) return
    const score = (v: ProductVariantInfo) =>
      options.reduce((n, o) => n + (o.name !== optionName && selected && v.options[o.name] === selected.options[o.name] ? 2 : 0), 0) +
      (variantStock(v) > 0 ? 1 : 0)
    const best = [...candidates].sort((a, b) => score(b) - score(a))[0]
    onSelect(best.id)
  }

  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const showSwatch = isColorOption(opt.name)
        return (
          <div key={opt.name}>
            <p className="text-xs text-gray-600 mb-1.5">
              {opt.name}: <span className="font-semibold text-gray-900">{selected?.options[opt.name] ?? "Select"}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {opt.values.map((value) => {
                const withValue = active.filter((v) => v.options[opt.name] === value)
                const exact = selected
                  ? withValue.find((v) => options.every((o) => o.name === opt.name || v.options[o.name] === selected.options[o.name]))
                  : withValue[0]
                const isSelected = selected?.options[opt.name] === value
                const unavailable = withValue.length === 0
                const outOfStock = !unavailable && (exact ? variantStock(exact) <= 0 : withValue.every((v) => variantStock(v) <= 0))
                const swatch = showSwatch ? cssColor(value) : null
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={unavailable}
                    onClick={() => choose(opt.name, value)}
                    aria-pressed={isSelected}
                    title={unavailable ? `${value} is not available` : outOfStock ? `${value} — out of stock` : value}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-primary-600"
                        : unavailable
                          ? "border-dashed border-gray-200 text-gray-300 cursor-not-allowed"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    } ${outOfStock && !unavailable ? "line-through decoration-gray-400" : ""}`}
                  >
                    {swatch && <span className="w-3.5 h-3.5 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: swatch }} />}
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {selected && variantStock(selected) <= 0 && (
        <p className="text-xs font-medium text-red-600">This option is out of stock. Choose another option.</p>
      )}
    </div>
  )
}
