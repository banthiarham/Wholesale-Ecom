import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toCsv, parseSheet, toNumber, toBool, isClear } from '../common/bulk-csv';
import { LIVE_VARIANTS_WHERE, syncProductFromVariants, variantLabel } from './variant-sync';

const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const ROLE_PREFIX = 'Role Price: ';
const ROLE_QTY_PREFIX = 'Role Quantity: ';

const BASE_HEADERS = [
  'ID', 'SKU', 'Title', 'URL Handle', 'Status', 'Categories', 'Company Name', 'Vendor Name', 'Tags', 'Description',
  'Unit Price', 'Compare At Price', 'MOQ', 'Inventory Quantity', 'Allow Backorder', 'Manage Inventory',
  'Tier Prices', 'Images',
];

const priceText = (n: unknown) => (n === null || n === undefined ? '' : String(Number(n)));

@Injectable()
export class ProductsBulkService {
  constructor(private prisma: PrismaService) {}

  /**
   * Every product (optionally one category) as CSV rows: all product details, tier prices, and for every role a
   * price column and a minimum-quantity column. The same file is accepted back by `importCsv`.
   */
  async exportCsv(categoryId?: string): Promise<Buffer> {
    const roles = await this.prisma.role.findMany({ orderBy: { name: 'asc' } });
    const products = await this.prisma.product.findMany({
      where: categoryId ? { categories: { some: { id: categoryId } } } : {},
      include: {
        categories: { select: { name: true } },
        category: { select: { name: true } },
        tierPrices: { orderBy: { minQty: 'asc' } },
        rolePrices: true,
      },
      orderBy: { title: 'asc' },
    });

    const roleHeaders = roles.flatMap((r) => [`${ROLE_PREFIX}${r.name}`, `${ROLE_QTY_PREFIX}${r.name}`]);
    const rows: Record<string, unknown>[] = [];
    for (const p of products as any[]) {
      const cats = p.categories?.length ? p.categories.map((c: any) => c.name) : p.category ? [p.category.name] : [];
      const row: Record<string, unknown> = {
        ID: p.id,
        SKU: p.sku || '',
        Title: p.title,
        'URL Handle': p.handle,
        Status: p.status,
        Categories: cats.join('|'),
        'Company Name': p.companyName || '',
        'Vendor Name': p.vendorName || '',
        Tags: (p.tags || []).join('|'),
        Description: p.description || '',
        'Unit Price': priceText(p.unitPrice),
        'Compare At Price': priceText(p.compareAtPrice),
        MOQ: p.moq,
        'Inventory Quantity': p.inventoryQuantity,
        'Allow Backorder': p.allowBackorder ? 'TRUE' : 'FALSE',
        'Manage Inventory': p.manageInventory ? 'TRUE' : 'FALSE',
        'Tier Prices': (p.tierPrices || []).map((t: any) => `${t.minQty}:${Number(t.price)}`).join('|'),
        Images: (p.images || []).join('|'),
      };
      for (const r of roles) {
        // The role's lowest quantity slab: its price and the minimum quantity that price starts at.
        const first = (p.rolePrices || []).filter((rp: any) => rp.roleId === r.id).sort((x: any, y: any) => x.minQty - y.minQty)[0];
        row[`${ROLE_PREFIX}${r.name}`] = first ? String(Number(first.price)) : '';
        row[`${ROLE_QTY_PREFIX}${r.name}`] = first ? first.minQty : '';
      }
      rows.push(row);
    }
    return toCsv([...BASE_HEADERS, ...roleHeaders], rows);
  }

  /**
   * Applies an edited export. Rows are matched by ID (or SKU). An empty cell leaves the field as it is, "-" clears
   * the optional ones (compare-at price, tier prices, a role price). Rows with a "Variant SKU" update that variant.
   */
  async importCsv(buffer: Buffer): Promise<{ updated: number; variantsUpdated: number; unchanged: number; errors: string[] }> {
    const sheet = await parseSheet(buffer);
    const roles = await this.prisma.role.findMany();
    const roleByKey = new Map<string, { id: string; name: string }>();
    for (const r of roles) {
      roleByKey.set(r.name.toLowerCase(), r);
      roleByKey.set(r.label.toLowerCase(), r);
    }
    const roleColumns: { role: { id: string; name: string }; priceHeader?: string; qtyHeader?: string }[] = [];
    for (const h of sheet.headers) {
      const m = h.match(/^role\s+(price|quantity)\s*:\s*(.+)$/i);
      if (!m) continue;
      const role = roleByKey.get(m[2].trim().toLowerCase());
      if (!role) continue;
      let col = roleColumns.find((c) => c.role.id === role.id);
      if (!col) roleColumns.push((col = { role }));
      if (m[1].toLowerCase() === 'price') col.priceHeader = h;
      else col.qtyHeader = h;
    }
    const categories = await this.prisma.category.findMany({ select: { id: true, name: true, handle: true } });
    const catByKey = new Map<string, string>();
    for (const c of categories) {
      catByKey.set(c.name.toLowerCase(), c.id);
      catByKey.set(c.handle.toLowerCase(), c.id);
    }

    let updated = 0;
    let variantsUpdated = 0;
    let unchanged = 0;
    const errors: string[] = [];

    for (const row of sheet.rows) {
      const where = `Row ${row.rowNumber}`;
      try {
        const id = row.get('ID') || '';
        const sku = row.get('SKU') || '';
        if (!id && !sku) { errors.push(`${where}: no ID or SKU`); continue; }

        const include = { categories: { select: { id: true } }, tierPrices: true, rolePrices: true };
        let product: any = id ? await this.prisma.product.findUnique({ where: { id }, include }) : null;
        if (!product && sku) product = await this.prisma.product.findUnique({ where: { sku }, include });
        if (!product) { errors.push(`${where}: product not found (${id || sku})`); continue; }

        // ── Variant row ──
        const variantSku = row.get('Variant SKU') || '';
        if (variantSku) {
          const variant = await this.prisma.productVariant.findFirst({ where: { sku: variantSku, productId: product.id } });
          if (!variant) { errors.push(`${where}: variant ${variantSku} not found on this product`); continue; }
          const vdata: Record<string, any> = {};
          const price = toNumber(row.get('Variant Price'));
          const stock = toNumber(row.get('Variant Stock'));
          const active = toBool(row.get('Variant Active'));
          if (price !== undefined) { if (Number.isNaN(price) || price < 0) { errors.push(`${where}: invalid Variant Price`); continue; } vdata.price = price; }
          if (stock !== undefined) { if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) { errors.push(`${where}: invalid Variant Stock`); continue; } vdata.inventoryQuantity = stock; }
          if (active !== undefined) vdata.isActive = active;
          if (Object.keys(vdata).length === 0) { unchanged++; continue; }
          await this.prisma.productVariant.update({ where: { id: variant.id }, data: vdata });
          await syncProductFromVariants(this.prisma, product.id);
          variantsUpdated++;
          continue;
        }

        // ── Product row ──
        const data: Record<string, any> = {};
        const bad = (msg: string) => { throw new Error(msg); };

        const title = row.get('Title', 'Product Title');
        if (title) data.title = title;
        const handle = row.get('URL Handle', 'Handle');
        if (handle) {
          if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle)) bad(`invalid URL Handle "${handle}" (lower-case letters, digits and dashes only)`);
          data.handle = handle;
        }
        const newSku = row.get('SKU');
        if (newSku && newSku !== product.sku) data.sku = newSku;
        const status = (row.get('Status') || '').toUpperCase();
        if (status) { if (!STATUSES.includes(status)) bad(`invalid Status "${status}"`); data.status = status; }
        for (const [col, field] of [['Company Name', 'companyName'], ['Vendor Name', 'vendorName'], ['Description', 'description']] as const) {
          const v = row.get(col);
          if (v === undefined || v === '') continue;
          data[field] = isClear(v) ? null : v;
        }
        const tags = row.get('Tags');
        if (tags !== undefined && tags !== '') data.tags = isClear(tags) ? [] : tags.split(/[|;,]/).map((t) => t.trim()).filter(Boolean);
        const images = row.get('Images');
        if (images !== undefined && images !== '' && !isClear(images)) {
          const list = images.split('|').map((t) => t.trim()).filter(Boolean);
          data.images = list;
          data.thumbnail = list[0] || null;
        }

        const unitPrice = toNumber(row.get('Unit Price', 'unitPrice'));
        if (unitPrice !== undefined && !product.hasVariants) {
          if (Number.isNaN(unitPrice) || unitPrice < 0) bad('invalid Unit Price');
          data.unitPrice = unitPrice;
        }
        const cmpText = row.get('Compare At Price', 'compareAtPrice');
        if (cmpText !== undefined && cmpText !== '') {
          if (isClear(cmpText)) data.compareAtPrice = null;
          else { const n = toNumber(cmpText); if (n === undefined || Number.isNaN(n) || n < 0) bad('invalid Compare At Price'); data.compareAtPrice = n; }
        }
        const moq = toNumber(row.get('MOQ'));
        if (moq !== undefined) { if (Number.isNaN(moq) || moq < 1 || !Number.isInteger(moq)) bad('MOQ must be a whole number of 1 or more'); data.moq = moq; }
        const stock = toNumber(row.get('Inventory Quantity', 'inventoryQuantity'));
        if (stock !== undefined && !product.hasVariants) {
          if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) bad('Inventory Quantity must be a whole number, 0 or more');
          data.inventoryQuantity = stock;
        }
        const backorder = toBool(row.get('Allow Backorder'));
        if (backorder !== undefined) data.allowBackorder = backorder;
        const manage = toBool(row.get('Manage Inventory'));
        if (manage !== undefined) data.manageInventory = manage;

        // Categories (by name or handle).
        const catText = row.get('Categories', 'Category');
        let categoryIds: string[] | undefined;
        if (catText !== undefined && catText !== '' && !isClear(catText)) {
          categoryIds = [];
          for (const name of catText.split(/[|;]/).map((c) => c.trim()).filter(Boolean)) {
            const cid = catByKey.get(name.toLowerCase());
            if (!cid) bad(`category "${name}" does not exist`);
            if (!categoryIds.includes(cid!)) categoryIds.push(cid!);
          }
        }

        // Tier prices "minQty:price|minQty:price".
        const tierText = row.get('Tier Prices');
        let tiers: { minQty: number; price: number }[] | undefined;
        if (tierText !== undefined && tierText !== '') tiers = isClear(tierText) ? [] : this.parsePairs(tierText, 'Tier Prices');

        // Role prices: one price and one minimum quantity per role. "-" in the price removes the role's price.
        const roleChanges: { roleId: string; prices: { minQty: number; price: number }[] }[] = [];
        for (const col of roleColumns) {
          const priceText = col.priceHeader ? row.raw[col.priceHeader] : undefined;
          const qtyText = col.qtyHeader ? row.raw[col.qtyHeader] : undefined;
          if ((priceText === undefined || priceText === '') && (qtyText === undefined || qtyText === '')) continue;
          if (priceText && isClear(priceText)) { roleChanges.push({ roleId: col.role.id, prices: [] }); continue; }
          const current = (product.rolePrices || []).filter((rp: any) => rp.roleId === col.role.id).sort((x: any, y: any) => x.minQty - y.minQty);
          // Several slabs typed into the price cell (old format "1:100|10:90") are still accepted as they are.
          if (priceText && /[|:]/.test(priceText)) { roleChanges.push({ roleId: col.role.id, prices: this.parsePairs(priceText, col.priceHeader!) }); continue; }
          const price = priceText ? toNumber(priceText) : current[0] ? Number(current[0].price) : undefined;
          const qty = qtyText ? toNumber(qtyText) : current[0] ? current[0].minQty : 1;
          if (price === undefined || Number.isNaN(price) || price < 0) throw new Error(`${col.priceHeader || col.qtyHeader}: enter a valid price`);
          if (qty === undefined || Number.isNaN(qty) || !Number.isInteger(qty) || qty < 1) throw new Error(`${col.qtyHeader || col.priceHeader}: quantity must be a whole number, 1 or more`);
          // Only the first slab is edited here; any further slabs the role has are kept.
          const rest = current.slice(1).filter((x: any) => x.minQty !== qty).map((x: any) => ({ minQty: x.minQty, price: Number(x.price) }));
          roleChanges.push({ roleId: col.role.id, prices: [{ minQty: qty, price }, ...rest] });
        }

        // Drop everything that already matches what is stored, so an unedited row counts as "no changes".
        const same = (a: unknown, b: unknown) => JSON.stringify(a instanceof Object && 'toNumber' in (a as any) ? Number(a) : a ?? null) === JSON.stringify(b ?? null);
        for (const k of Object.keys(data)) if (same(product[k], data[k])) delete data[k];
        if (categoryIds) {
          const cur = (product.categories || []).map((c: any) => c.id).sort();
          if (JSON.stringify(cur) === JSON.stringify([...categoryIds].sort())) categoryIds = undefined;
        }
        const pairKey = (list: { minQty: number; price: unknown }[]) => JSON.stringify(list.map((x) => [x.minQty, Number(x.price)]).sort((a, b) => a[0] - b[0]));
        if (tiers && pairKey(tiers) === pairKey(product.tierPrices || [])) tiers = undefined;
        for (let i = roleChanges.length - 1; i >= 0; i--) {
          const cur = (product.rolePrices || []).filter((rp: any) => rp.roleId === roleChanges[i].roleId);
          if (pairKey(roleChanges[i].prices) === pairKey(cur)) roleChanges.splice(i, 1);
        }

        const hasChange = Object.keys(data).length > 0 || categoryIds !== undefined || tiers !== undefined || roleChanges.length > 0;
        if (!hasChange) { unchanged++; continue; }

        await this.prisma.$transaction(async (tx) => {
          if (categoryIds) {
            data.categories = { set: categoryIds.map((cid) => ({ id: cid })) };
            if (!categoryIds.includes(product.categoryId)) data.category = { connect: { id: categoryIds[0] } };
          }
          if (Object.keys(data).length) await tx.product.update({ where: { id: product.id }, data });
          if (tiers) {
            await tx.tierPrice.deleteMany({ where: { productId: product.id } });
            if (tiers.length) await tx.tierPrice.createMany({ data: tiers.map((t) => ({ productId: product.id, minQty: t.minQty, price: t.price })) });
          }
          for (const rc of roleChanges) {
            await tx.rolePrice.deleteMany({ where: { productId: product.id, roleId: rc.roleId } });
            if (rc.prices.length) await tx.rolePrice.createMany({ data: rc.prices.map((p) => ({ productId: product.id, roleId: rc.roleId, minQty: p.minQty, price: p.price, isActive: true })) });
          }
        });
        updated++;
      } catch (err: any) {
        const msg = String(err?.message || 'Unknown error');
        errors.push(`${row.rowNumber ? `Row ${row.rowNumber}` : 'Row'}: ${/Unique constraint/i.test(msg) ? 'SKU or URL Handle already used by another product' : msg.split('\n').pop()}`);
      }
    }
    return { updated, variantsUpdated, unchanged, errors };
  }

  /** "120" -> [{1,120}]; "1:120|10:110" -> [{1,120},{10,110}]. */
  private parsePairs(text: string, column: string): { minQty: number; price: number }[] {
    const out: { minQty: number; price: number }[] = [];
    for (const part of text.split('|').map((p) => p.trim()).filter(Boolean)) {
      const [a, b] = part.includes(':') ? part.split(':') : ['1', part];
      const minQty = Number(a);
      const price = toNumber(b);
      if (!Number.isInteger(minQty) || minQty < 1 || price === undefined || Number.isNaN(price) || price < 0) {
        throw new Error(`${column}: "${part}" is not valid (use price, or minQty:price separated by |)`);
      }
      if (out.some((o) => o.minQty === minQty)) throw new Error(`${column}: quantity ${minQty} appears twice`);
      out.push({ minQty, price });
    }
    return out;
  }
}
