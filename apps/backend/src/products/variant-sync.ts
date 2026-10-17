import { Prisma } from '@prisma/client';

/** Variants removed by the admin but kept because orders reference them get this optionsKey prefix. */
export const ARCHIVED_VARIANT_PREFIX = 'archived:';

/** Prisma filter for variants that are still part of the product (not archived). */
export const LIVE_VARIANTS_WHERE = { NOT: { optionsKey: { startsWith: ARCHIVED_VARIANT_PREFIX } } };

type Db = Prisma.TransactionClient | { product: any; productVariant: any };

/**
 * A product with variants keeps its own unitPrice / stock in step with its variants, so listings,
 * sorting, price filters and stock badges keep working unchanged: unitPrice = lowest active variant
 * price, inventory/reserved = totals over the active variants.
 */
export async function syncProductFromVariants(db: Db, productId: string) {
  const variants = await (db as any).productVariant.findMany({
    where: { productId, ...LIVE_VARIANTS_WHERE },
    select: { price: true, inventoryQuantity: true, reservedQuantity: true, isActive: true },
  });
  if (variants.length === 0) return;
  const active = variants.filter((v: any) => v.isActive);
  const priced = active.length ? active : variants;
  const unitPrice = Math.min(...priced.map((v: any) => Number(v.price)));
  const inventoryQuantity = active.reduce((s: number, v: any) => s + v.inventoryQuantity, 0);
  const reservedQuantity = active.reduce((s: number, v: any) => s + v.reservedQuantity, 0);
  await (db as any).product.update({
    where: { id: productId },
    data: { unitPrice, inventoryQuantity, reservedQuantity },
  });
}

/** "Black / 128 GB" — the variant's option values in the product's option order. */
export function variantLabel(options: Record<string, string> | null | undefined, optionOrder?: { name: string }[]) {
  if (!options) return '';
  const names = optionOrder?.length ? optionOrder.map((o) => o.name) : Object.keys(options);
  return names.map((n) => options[n]).filter(Boolean).join(' / ');
}
