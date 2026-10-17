/**
 * Free items from "buy X get Y free" offers are stored as separate zero-price cart rows. In the
 * UI they are never listed (or editable) on their own: they appear as a note under the product
 * that earns them, e.g. "+1 free", and the number follows the paid quantity.
 */
export interface FreeLine {
  /** Free units currently in the cart for this product. */
  quantity: number
  /** Units of the paid product that earn one batch of free units (when known). */
  buyQuantity: number | null
  /** Free units per batch. */
  freeQuantity: number
  title: string
  handle: string | null
  thumbnail: string | null
  /** Normal (non-free) unit price of the free product. */
  worth: number
  /** True when the free item is the same product as the paid one. */
  sameProduct: boolean
  ruleName: string
}

export const isFreeItem = (item: any): boolean => item?.metadata?.bogo === true

export function freeLinesFor(items: any[], buyProductId: string): FreeLine[] {
  return (items || [])
    .filter((i) => isFreeItem(i) && i.metadata?.buyProductId === buyProductId)
    .map((i) => ({
      quantity: i.quantity,
      buyQuantity: Number(i.metadata?.buyQuantity) || null,
      freeQuantity: Number(i.metadata?.freeQuantity) || 1,
      title: i.product?.title || "Free item",
      handle: i.product?.handle || null,
      thumbnail: i.product?.thumbnail || null,
      worth: Number(i.product?.unitPrice) || 0,
      sameProduct: i.productId === buyProductId || i.product?.id === buyProductId,
      ruleName: i.metadata?.bogoRuleName || "Offer",
    }))
}

/** Free units to show for a paid quantity (updates live while the shopper edits the quantity). */
export function freeQuantityFor(line: FreeLine, paidQuantity: number): number {
  if (line.buyQuantity && line.buyQuantity > 0) {
    return Math.floor(paidQuantity / line.buyQuantity) * line.freeQuantity
  }
  return line.quantity
}
