/* eslint-disable */
// End-to-end check of product variants against the running local API (http://localhost:3000).
// Creates its own test buyer + products, verifies behaviour, then removes everything it created.
// Run from apps/backend:  node scripts/variants-e2e.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();
const tag = `vtest-${Date.now()}`;
let passed = 0;
const failures = [];
const check = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
};

async function call(method, path, token, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const sign = (u) => jwt.sign({ sub: u.id, email: u.email, role: u.role, roleId: u.roleId || undefined }, process.env.JWT_SECRET, { expiresIn: '15m' });

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin user in the database');
  const adminToken = sign(admin);
  const buyer = await prisma.user.create({ data: { email: `${tag}@example.test`, firstName: 'Variant', lastName: 'Tester' } });
  const buyerToken = sign(buyer);
  const created = { products: [], orders: [] };

  try {
    console.log('1. Single product without variants');
    const simple = await call('POST', '/products', adminToken, {
      title: `${tag} simple`, handle: `${tag}-simple`, sku: `${tag}-S`, moq: 1, unitPrice: 100, inventoryQuantity: 10, status: 'PUBLISHED',
    });
    check('create simple product', simple.status === 201 && simple.data.product.hasVariants === false, simple.data);
    created.products.push(simple.data.product.id);
    check('simple product has no variants', simple.data.product.variants.length === 0);

    console.log('2. Product with variants (Color x Storage, Blue / 256 GB excluded)');
    const options = [{ name: 'Color', values: ['Black', 'Blue'] }, { name: 'Storage', values: ['128 GB', '256 GB'] }];
    const variants = [
      { options: { Color: 'Black', Storage: '128 GB' }, sku: `${tag}-BLK-128`, price: 500, inventoryQuantity: 5 },
      { options: { Color: 'Black', Storage: '256 GB' }, sku: `${tag}-BLK-256`, price: 700, inventoryQuantity: 0 },
      { options: { Color: 'Blue', Storage: '128 GB' }, sku: `${tag}-BLU-128`, price: 550, inventoryQuantity: 3, images: ['/uploads/products/x.webp', '/uploads/products/y.webp', '/uploads/products/x.webp'] },
    ];
    const base = { title: `${tag} phone`, handle: `${tag}-phone`, moq: 1, unitPrice: 1, inventoryQuantity: 0, status: 'PUBLISHED' };
    const vp = await call('POST', '/products', adminToken, { ...base, hasVariants: true, variantOptions: options, variants });
    check('create variant product', vp.status === 201 && vp.data.product.hasVariants === true, vp.data);
    const product = vp.data.product;
    created.products.push(product.id);
    check('3 variants saved', product.variants.length === 3, product.variants.length);
    check('product price = lowest variant price', Number(product.unitPrice) === 500, product.unitPrice);
    check('product stock = total variant stock', product.inventoryQuantity === 8, product.inventoryQuantity);
    const blu = product.variants.find((v) => v.sku.endsWith('BLU-128'));
    check('variant gallery saved (duplicates dropped)', JSON.stringify(blu.images) === JSON.stringify(['/uploads/products/x.webp', '/uploads/products/y.webp']), blu.images);
    check('variant main image mirrors first image', blu.image === '/uploads/products/x.webp', blu.image);
    check('variant without images has an empty gallery', product.variants.find((v) => v.sku.endsWith('BLK-128')).images.length === 0);
    const tooManyImgs = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-img`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0], sku: `${tag}-IMG`, images: Array.from({ length: 11 }, (_, i) => `/uploads/products/i${i}.webp`) }] });
    check('more than 10 variant images rejected', tooManyImgs.status === 400, tooManyImgs.data);
    // Upload endpoint: a real 1x1 PNG is stored and a URL comes back
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('images', new Blob([png], { type: 'image/png' }), 'one.png');
    fd.append('images', new Blob([png], { type: 'image/png' }), 'two.png');
    const up = await fetch(`${API}/products/variant-images`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: fd });
    const upData = await up.json();
    check('variant image upload returns URLs', up.status === 201 && upData.uploaded.length === 2 && upData.uploaded.every((u) => /^\/uploads\/products\/.+\.(webp|png|jpe?g)$/.test(u)), upData);
    const served = upData.uploaded && upData.uploaded[0] ? await fetch(`http://localhost:3000${upData.uploaded[0]}`) : { status: 0 };
    check('uploaded image is served', served.status === 200, served.status);
    const upBuyer = await fetch(`${API}/products/variant-images`, { method: 'POST', headers: { Authorization: `Bearer ${buyerToken}` }, body: fd });
    check('non-admin cannot upload variant images', upBuyer.status === 403, upBuyer.status);
    const upNone = await fetch(`${API}/products/variant-images`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: new FormData() });
    check('upload with no files rejected', upNone.status === 400, upNone.status);
    const withUploaded = await call('PUT', `/products/${product.id}`, adminToken, {
      hasVariants: true, variantOptions: options,
      variants: product.variants.map((v) => ({ id: v.id, options: v.options, sku: v.sku, price: Number(v.price), inventoryQuantity: v.inventoryQuantity, images: v.sku.endsWith('BLK-128') ? upData.uploaded : v.images, isActive: true })),
    });
    const blk = withUploaded.data.product.variants.find((v) => v.sku.endsWith('BLK-128'));
    check('uploaded images attach to the chosen variant only', JSON.stringify(blk.images) === JSON.stringify(upData.uploaded) && withUploaded.data.product.variants.find((v) => v.sku.endsWith('BLU-128')).images.length === 2, blk.images);
    for (const u of upData.uploaded || []) { try { require('fs').unlinkSync(require('path').join(process.cwd(), u)); } catch {} }
    const vBlack128 = product.variants.find((v) => v.sku === `${tag}-BLK-128`);
    const vBlack256 = product.variants.find((v) => v.sku === `${tag}-BLK-256`);
    const vBlue128 = product.variants.find((v) => v.sku === `${tag}-BLU-128`);

    console.log('3. Validation');
    const dupSku = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-x1`, hasVariants: true, variantOptions: options, variants: [variants[0], { ...variants[1], sku: variants[0].sku }] });
    check('duplicate SKU in one product rejected', dupSku.status === 400, dupSku.data);
    const dupCombo = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-x2`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0], sku: `${tag}-A` }, { ...variants[0], sku: `${tag}-B` }] });
    check('duplicate combination rejected', dupCombo.status === 400, dupCombo.data);
    const badValue = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-x3`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0], sku: `${tag}-C`, options: { Color: 'Red', Storage: '128 GB' } }] });
    check('value not in option list rejected', badValue.status === 400, badValue.data);
    const usedSku = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-x4`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0], sku: `${tag}-S` }] });
    check("SKU of another product rejected", usedSku.status === 400, usedSku.data);
    const otherVariantSku = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-x5`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0] }] });
    check("SKU of another product's variant rejected", otherVariantSku.status === 400, otherVariantSku.data);
    const badPrice = await call('POST', '/products', adminToken, { ...base, handle: `${tag}-x6`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0], sku: `${tag}-D`, price: -1 }] });
    check('negative price rejected', badPrice.status === 400, badPrice.data);
    const noAuth = await call('POST', '/products', buyerToken, { ...base, handle: `${tag}-x7`, hasVariants: true, variantOptions: options, variants: [{ ...variants[0], sku: `${tag}-E` }] });
    check('non-admin cannot create products', noAuth.status === 403, noAuth.status);
    const leftovers = await prisma.product.count({ where: { handle: { startsWith: `${tag}-x` } } });
    check('rejected saves created nothing', leftovers === 0, leftovers);

    console.log('4. Editing one variant does not affect another');
    const editPayload = product.variants.map((v) => ({
      id: v.id, options: v.options, sku: v.sku, price: v.id === vBlack128.id ? 520 : Number(v.price), inventoryQuantity: v.inventoryQuantity, images: v.images, isActive: v.isActive,
    }));
    const edit = await call('PUT', `/products/${product.id}`, adminToken, { hasVariants: true, variantOptions: options, variants: editPayload });
    check('update saved', edit.status === 200, edit.data);
    const after = edit.data.product.variants;
    check('edited variant price changed', Number(after.find((v) => v.id === vBlack128.id).price) === 520);
    check('other variant unchanged', Number(after.find((v) => v.id === vBlue128.id).price) === 550 && after.find((v) => v.id === vBlue128.id).inventoryQuantity === 3);
    check('variant ids stable after edit', after.every((v) => product.variants.some((p) => p.id === v.id)));
    const statusOnly = await call('PUT', `/products/${product.id}`, adminToken, { status: 'PUBLISHED' });
    check('update without variant fields keeps variants', statusOnly.data.product.variants.length === 3, statusOnly.data.product.variants.length);

    console.log('5. Storefront product + pricing');
    const pub = await call('GET', `/products/${product.handle}`);
    check('product page data has options and variants', pub.data.product.variantOptions.length === 2 && pub.data.product.variants.length === 3);
    const price = await call('GET', `/pricing/calculate?productId=${product.id}&quantity=1&variantId=${vBlue128.id}`);
    check('pricing uses the variant price', price.data.finalPrice === 550, price.data);

    console.log('6. Cart');
    const sid = { 'x-session-id': `${tag}-session` };
    const noVariant = await call('POST', '/cart', null, { productId: product.id, quantity: 1 }, sid);
    check('variant product without variantId rejected', noVariant.status === 400, noVariant.data);
    const oos = await call('POST', '/cart', null, { productId: product.id, quantity: 1, variantId: vBlack256.id }, sid);
    check('out-of-stock variant cannot be added', oos.status === 400, oos.data);
    const tooMany = await call('POST', '/cart', null, { productId: product.id, quantity: 6, variantId: vBlack128.id }, sid);
    check('more than variant stock rejected', tooMany.status === 400, tooMany.data);
    const wrongVariant = await call('POST', '/cart', null, { productId: simple.data.product.id, quantity: 1, variantId: vBlack128.id }, sid);
    check('variantId on a simple product rejected', wrongVariant.status === 400, wrongVariant.data);
    const addSimple = await call('POST', '/cart', null, { productId: simple.data.product.id, quantity: 1 }, sid);
    check('simple product still adds to cart', addSimple.status === 201 || addSimple.status === 200, addSimple.data);

    const add1 = await call('POST', '/cart', buyerToken, { productId: product.id, quantity: 2, variantId: vBlack128.id });
    check('add variant to cart', add1.status === 201 || add1.status === 200, add1.data);
    const add2 = await call('POST', '/cart', buyerToken, { productId: product.id, quantity: 1, variantId: vBlue128.id });
    const lines = add2.data.cart.items.filter((i) => i.productId === product.id);
    check('two variants = two cart lines', lines.length === 2, lines.length);
    const line1 = lines.find((i) => i.variantId === vBlack128.id);
    check('cart line uses variant id and price', line1 && Number(line1.unitPrice) === 520, line1);
    check('cart line shows variant label and SKU', line1 && line1.product.title.endsWith('(Black / 128 GB)') && line1.product.sku === `${tag}-BLK-128`, line1 && line1.product);
    const add3 = await call('POST', '/cart', buyerToken, { productId: product.id, quantity: 1, variantId: vBlack128.id });
    const merged = add3.data.cart.items.find((i) => i.variantId === vBlack128.id);
    check('same variant again increases quantity', merged.quantity === 3, merged.quantity);

    console.log('7. Order reserves and releases variant stock');
    const order = await call('POST', '/orders', buyerToken, {
      cartId: add3.data.cart.id, paymentMethod: 'COD',
      shippingAddress: { fullName: 'Variant Tester', phone: '9876543210', street: '1 Test St', city: 'Jaipur', state: 'Rajasthan', zip: '302017', country: 'India' },
    });
    check('order placed', order.status === 201, order.data);
    if (order.data?.order) {
      created.orders.push(order.data.order.id);
      const items = await prisma.orderItem.findMany({ where: { orderId: order.data.order.id } });
      const oi = items.find((i) => i.variantId === vBlack128.id);
      check('order item stores variant id', !!oi);
      check('order item keeps variant snapshot', oi && oi.metadata.variant.label === 'Black / 128 GB' && oi.metadata.variant.sku === `${tag}-BLK-128`, oi && oi.metadata);
      const v1 = await prisma.productVariant.findUnique({ where: { id: vBlack128.id } });
      check('variant stock reserved', v1.reservedQuantity === 3, v1.reservedQuantity);
      const other = await prisma.productVariant.findUnique({ where: { id: vBlack256.id } });
      check('other variant stock untouched', other.reservedQuantity === 0);
      const view = await call('GET', `/orders/${order.data.order.id}`, buyerToken);
      check('order shows variant in title', view.data.order.items.some((i) => i.product.title.endsWith('(Black / 128 GB)')), view.data.order.items.map((i) => i.product.title));
      const cancel = await call('PUT', `/orders/${order.data.order.id}/cancel`, buyerToken);
      check('order cancelled', cancel.status === 200, cancel.data);
      const v1b = await prisma.productVariant.findUnique({ where: { id: vBlack128.id } });
      check('variant stock released on cancel', v1b.reservedQuantity === 0, v1b.reservedQuantity);
    }

    console.log('8. Removing variants');
    const keepOnlyBlue = (await call('GET', `/products/${product.handle}`)).data.product.variants
      .filter((v) => v.id === vBlue128.id)
      .map((v) => ({ id: v.id, options: v.options, sku: v.sku, price: Number(v.price), inventoryQuantity: v.inventoryQuantity, image: v.image, isActive: true }));
    const removed = await call('PUT', `/products/${product.id}`, adminToken, { hasVariants: true, variantOptions: options, variants: keepOnlyBlue });
    check('save with two variants removed', removed.status === 200 && removed.data.product.variants.length === 1, removed.data);
    const archived = await prisma.productVariant.findUnique({ where: { id: vBlack128.id } });
    check('variant used by an order is archived, not deleted', archived && archived.isActive === false && archived.optionsKey.startsWith('archived:'), archived);
    const deleted = await prisma.productVariant.findUnique({ where: { id: vBlack256.id } });
    check('unused variant is deleted', deleted === null);
    const readd = await call('PUT', `/products/${product.id}`, adminToken, {
      hasVariants: true, variantOptions: options,
      variants: [...keepOnlyBlue, { options: { Color: 'Black', Storage: '128 GB' }, sku: `${tag}-BLK-128`, price: 500, inventoryQuantity: 1 }],
    });
    check('archived combination and SKU can be added again', readd.status === 200 && readd.data.product.variants.length === 2, readd.data);

    console.log('9. Turning variants off');
    const off = await call('PUT', `/products/${product.id}`, adminToken, { hasVariants: false, unitPrice: 999, inventoryQuantity: 4 });
    check('variants switched off', off.status === 200 && off.data.product.hasVariants === false && off.data.product.variants.length === 0, off.data);
    check('product uses its own price again', Number(off.data.product.unitPrice) === 999 && off.data.product.inventoryQuantity === 4);
    const addAfterOff = await call('POST', '/cart', null, { productId: product.id, quantity: 1 }, sid);
    check('former variant product adds to cart as a single product', addAfterOff.status === 201 || addAfterOff.status === 200, addAfterOff.data);
  } finally {
    // Clean up everything this run created.
    for (const id of created.orders) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.payment.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await prisma.cart.deleteMany({ where: { OR: [{ userId: buyer.id }, { sessionId: `${tag}-session` }] } });
    await prisma.notification.deleteMany({ where: { userId: buyer.id } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId: buyer.id } });
    for (const id of created.products) {
      await prisma.inventoryLog.deleteMany({ where: { productId: id } });
      await prisma.cartItem.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } }).catch((e) => console.log('cleanup product failed', e.message));
    }
    await prisma.user.delete({ where: { id: buyer.id } }).catch((e) => console.log('cleanup user failed', e.message));
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log('Failed:', failures); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
