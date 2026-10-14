/* eslint-disable */
// End-to-end check of "buy X get Y free" offers (incl. products with variants) against the
// running local API (http://localhost:3000). Creates its own buyer, products and rules, checks the
// behaviour, then removes everything it created.
// Run from apps/backend:  node scripts/bogo-e2e.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();
const tag = `btest-${Date.now()}`;
let passed = 0;
const failures = [];
const check = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
};
const sign = (u) => jwt.sign({ sub: u.id, email: u.email, role: u.role, roleId: u.roleId || undefined }, process.env.JWT_SECRET, { expiresIn: '15m' });

async function call(method, path, token, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, ok: res.status >= 200 && res.status < 300, data };
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminToken = sign(admin);
  const buyer = await prisma.user.create({ data: { email: `${tag}@example.test`, firstName: 'Bogo', lastName: 'Tester' } });
  const T = sign(buyer);
  const created = { products: [], rules: [], orders: [] };
  const now = new Date();
  const later = new Date(Date.now() + 7 * 864e5);

  const product = async (body) => {
    const r = await call('POST', '/products', adminToken, { moq: 1, status: 'PUBLISHED', ...body });
    if (r.status !== 201) throw new Error(`product create failed: ${JSON.stringify(r.data)}`);
    created.products.push(r.data.product.id);
    return r.data.product;
  };
  const rule = async (data) => {
    const r = await prisma.dynamicRule.create({ data: { startDate: now, endDate: later, isActive: true, ...data } });
    created.rules.push(r.id);
    return r;
  };
  const cart = async (token = T, headers = {}) => (await call('GET', '/cart', token, null, headers)).data.cart;
  const free = (c, productId) => c.items.filter((i) => i.metadata?.bogo === true && (!productId || i.productId === productId));
  const freeQty = (c, productId) => free(c, productId).reduce((s, i) => s + i.quantity, 0);
  const line = (c, variantId) => c.items.find((i) => i.variantId === variantId && i.metadata?.bogo !== true);
  const add = (productId, quantity, variantId, token = T, headers = {}) =>
    call('POST', '/cart', token, { productId, quantity, ...(variantId ? { variantId } : {}) }, headers);
  const setQty = (itemId, quantity, token = T) => call('PUT', '/cart', token, { itemId, quantity });
  const remove = (itemId, token = T) => call('DELETE', '/cart', token, { itemId });
  const clear = async () => { const c = await cart(); for (const i of c.items) await prisma.cartItem.delete({ where: { id: i.id } }); };

  try {
    // ── Fixtures ──
    const opts = [{ name: 'Colour', values: ['Black', 'Blue', 'Red'] }];
    const V = await product({
      title: `${tag} earpods`, handle: `${tag}-earpods`, unitPrice: 1, inventoryQuantity: 0,
      hasVariants: true, variantOptions: opts,
      variants: [
        { options: { Colour: 'Black' }, sku: `${tag}-BLK`, price: 1000, inventoryQuantity: 20 },
        { options: { Colour: 'Blue' }, sku: `${tag}-BLU`, price: 1000, inventoryQuantity: 20 },
        { options: { Colour: 'Red' }, sku: `${tag}-RED`, price: 1100, inventoryQuantity: 20 },
      ],
    });
    const [vBlack, vBlue, vRed] = ['BLK', 'BLU', 'RED'].map((k) => V.variants.find((v) => v.sku.endsWith(k)));
    const S = await product({ title: `${tag} simple`, handle: `${tag}-simple`, sku: `${tag}-S`, unitPrice: 200, inventoryQuantity: 50 });
    const F = await product({ title: `${tag} gift`, handle: `${tag}-gift`, sku: `${tag}-F`, unitPrice: 50, inventoryQuantity: 5 });
    const S2 = await product({ title: `${tag} simple2`, handle: `${tag}-simple2`, sku: `${tag}-S2`, unitPrice: 300, inventoryQuantity: 50 });
    const W = await product({
      title: `${tag} gift-variants`, handle: `${tag}-giftv`, unitPrice: 1, inventoryQuantity: 0,
      hasVariants: true, variantOptions: [{ name: 'Size', values: ['S', 'M'] }],
      variants: [
        { options: { Size: 'S' }, sku: `${tag}-W-S`, price: 80, inventoryQuantity: 0 },
        { options: { Size: 'M' }, sku: `${tag}-W-M`, price: 80, inventoryQuantity: 3 },
      ],
    });
    const S3 = await product({ title: `${tag} simple3`, handle: `${tag}-simple3`, sku: `${tag}-S3`, unitPrice: 300, inventoryQuantity: 50 });
    const OOS = await product({ title: `${tag} gift-oos`, handle: `${tag}-giftoos`, sku: `${tag}-OOS`, unitPrice: 30, inventoryQuantity: 0 });

    const R3for1 = await rule({ name: `${tag} buy3get1`, type: 'BOGO', conditions: { buyProductId: V.id, buyQuantity: 3 }, actions: { freeProductId: V.id, freeQuantity: 1 } });
    const R10for5 = await rule({ name: `${tag} buy10get5`, type: 'BOGO', conditions: { buyProductId: V.id, buyQuantity: 10 }, actions: { freeProductId: V.id, freeQuantity: 5 } });
    await rule({ name: `${tag} buy2S-getF`, type: 'BUY_X_AND_Y_FREE', conditions: { buyProductId: S.id, buyQuantity: 2 }, actions: { freeProductId: F.id, freeQuantity: 1 } });
    await rule({ name: `${tag} buy2S2-getW`, type: 'BOGO', conditions: { buyProductId: S2.id, buyQuantity: 2 }, actions: { freeProductId: W.id, freeQuantity: 1 } });
    await rule({ name: `${tag} buy1S3-getOOS`, type: 'BOGO', conditions: { buyProductId: S3.id, buyQuantity: 1 }, actions: { freeProductId: OOS.id, freeQuantity: 1 } });

    console.log('A. Buy 3 (different variants) get 1 free');
    await add(V.id, 1, vBlack.id);
    await add(V.id, 1, vBlue.id);
    let c = await cart();
    check('2 units -> no free item yet', freeQty(c, V.id) === 0, free(c));
    await add(V.id, 1, vRed.id);
    c = await cart();
    check('Black + Blue + Red (3 units, all different) -> 1 free', freeQty(c, V.id) === 1, free(c));
    const f1 = free(c, V.id)[0];
    check('free item costs 0', f1 && Number(f1.unitPrice) === 0, f1 && f1.unitPrice);
    check('free item is a real, active variant of the product', f1 && [vBlack.id, vBlue.id, vRed.id].includes(f1.variantId), f1 && f1.variantId);
    check('free item shows its variant in the title', f1 && /\((Black|Blue|Red)\)$/.test(f1.product.title), f1 && f1.product.title);
    check('cart total only counts the 3 paid units', (() => { const t = c.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0); return t === 3100; })());

    console.log('B. Quantity changes');
    await setQty(line(c, vBlack.id).id, 3);
    c = await cart();
    check('5 units -> still 1 free', freeQty(c, V.id) === 1, freeQty(c, V.id));
    await setQty(line(c, vBlack.id).id, 4);
    c = await cart();
    check('6 units -> 2 free', freeQty(c, V.id) === 2, freeQty(c, V.id));
    await setQty(line(c, vBlack.id).id, 1);
    c = await cart();
    check('back to 3 units -> free trimmed to 1', freeQty(c, V.id) === 1, freeQty(c, V.id));
    check('free item cannot be edited by the shopper', (await setQty(free(c, V.id)[0].id, 5)).status === 400);

    console.log('C. Removing items');
    await remove(line(c, vRed.id).id);
    c = await cart();
    check('remove 1 of 3 -> offer no longer met, free item removed', freeQty(c, V.id) === 0, free(c));
    await add(V.id, 1, vRed.id);
    c = await cart();
    check('add it back -> free item returns', freeQty(c, V.id) === 1, free(c));
    await setQty(line(c, vBlue.id).id, 1);
    await remove(line(c, vBlack.id).id);
    c = await cart();
    check('drop below 3 by removing a different variant -> free removed', freeQty(c, V.id) === 0, free(c));
    await add(V.id, 1, vBlack.id);
    c = await cart();
    check('3 again -> free again', freeQty(c, V.id) === 1);
    const freeLine = free(c, V.id)[0];
    await remove(freeLine.id);
    c = await cart();
    check('removing the free item itself leaves paid items untouched', c.items.filter((i) => i.productId === V.id && i.metadata?.bogo !== true).length === 3);

    console.log('D. Choosing between offers');
    await clear();
    await add(V.id, 3, vBlack.id);
    c = await cart();
    check('3 units: buy3get1 applies (buy10get5 not met)', freeQty(c, V.id) === 1 && free(c, V.id)[0].metadata.bogoRuleName === R3for1.name, free(c));
    await add(V.id, 7, vBlue.id);
    c = await cart();
    check('10 units, no pick: the better offer (buy10get5) applies -> 5 free', freeQty(c, V.id) === 5 && free(c).every((i) => i.metadata.bogoRuleName === R10for5.name), free(c).map((i) => [i.quantity, i.metadata.bogoRuleName]));
    await call('PUT', '/cart/offer', T, { productId: V.id, choice: R3for1.id });
    c = await cart();
    check('pick buy3get1 at 10 units -> 3 free from that offer only', freeQty(c, V.id) === 3 && free(c).every((i) => i.metadata.bogoRuleName === R3for1.name), free(c).map((i) => [i.quantity, i.metadata.bogoRuleName]));
    await call('PUT', '/cart/offer', T, { productId: V.id, choice: 'none' });
    c = await cart();
    check('pick "no offer" -> no free items', freeQty(c, V.id) === 0, free(c));
    await call('PUT', '/cart/offer', T, { productId: V.id, choice: R10for5.id });
    c = await cart();
    check('switch to buy10get5 -> 5 free', freeQty(c, V.id) === 5, freeQty(c, V.id));
    await setQty(line(c, vBlue.id).id, 6);
    c = await cart();
    check('picked offer no longer met (9 units) -> falls back to buy3get1 -> 3 free', freeQty(c, V.id) === 3 && free(c).every((i) => i.metadata.bogoRuleName === R3for1.name), free(c).map((i) => [i.quantity, i.metadata.bogoRuleName]));

    console.log('E. Free product different from the bought product');
    await clear();
    await add(S.id, 1);
    c = await cart();
    check('buy 1 of 2 -> no gift', freeQty(c, F.id) === 0);
    await add(S.id, 1);
    c = await cart();
    check('buy 2 -> 1 gift (other product) free', freeQty(c, F.id) === 1 && Number(free(c, F.id)[0].unitPrice) === 0, free(c));
    await setQty(c.items.find((i) => i.productId === S.id).id, 1);
    c = await cart();
    check('reduce to 1 -> gift removed', freeQty(c, F.id) === 0, free(c));

    console.log('F. Free product with variants / stock');
    await clear();
    await add(S2.id, 2);
    c = await cart();
    const wf = free(c, W.id)[0];
    check('free product with variants -> an in-stock variant is given', !!wf && wf.variantId === W.variants.find((v) => v.sku.endsWith('W-M')).id, wf);
    await clear();
    await add(S3.id, 1);
    c = await cart();
    check('free product out of stock -> no free item, no error', freeQty(c, OOS.id) === 0 && c.items.some((i) => i.productId === S3.id));

    console.log('G. Rule switched off / expired');
    await clear();
    await add(S.id, 2);
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { isActive: false } });
    await add(S.id, 1);
    c = await cart();
    check('inactive offer -> gift removed on the next cart change', freeQty(c, F.id) === 0, free(c));
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { isActive: true, endDate: new Date(Date.now() - 864e5) } });
    await setQty(c.items.find((i) => i.productId === S.id).id, 4);
    c = await cart();
    check('expired offer -> no gift', freeQty(c, F.id) === 0, free(c));
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { endDate: later } });

    console.log('H. Guest cart and login merge');
    const sid = { 'x-session-id': `${tag}-guest` };
    await clear();
    await add(V.id, 1, vBlack.id, null, sid);
    await add(V.id, 1, vBlue.id, null, sid);
    await add(V.id, 1, vRed.id, null, sid);
    let g = (await call('GET', '/cart', null, null, sid)).data.cart;
    check('guest: no free items (offers are for signed-in buyers)', freeQty(g, V.id) === 0);
    const merged = await call('POST', '/cart/merge', T, { sessionId: `${tag}-guest`, userId: buyer.id });
    c = await cart();
    check('after login the merged cart gets its free item', merged.ok && freeQty(c, V.id) === 1, { status: merged.status, free: free(c) });

    console.log('I. Product page counts what is already in the cart');
    const po = await call('GET', `/rules/product-offers?productId=${V.id}&quantity=1&inCart=2`);
    const o3 = po.data.offers.find((o) => o.ruleId === R3for1.id);
    check('1 on page + 2 in cart -> buy3get1 shown as met', o3 && o3.eligible === true && o3.unitsNeeded === 0, o3);
    const po2 = await call('GET', `/rules/product-offers?productId=${V.id}&quantity=1`);
    const o3b = po2.data.offers.find((o) => o.ruleId === R3for1.id);
    check('1 on page, empty cart -> needs 2 more', o3b && o3b.eligible === false && o3b.unitsNeeded === 2, o3b);

    console.log('J. Checkout');
    await clear();
    await add(V.id, 1, vBlack.id);
    await add(V.id, 1, vBlue.id);
    await add(V.id, 1, vRed.id);
    c = await cart();
    const freeVariant = free(c, V.id)[0].variantId;
    const before = await prisma.productVariant.findUnique({ where: { id: freeVariant } });
    const addr = { fullName: 'Bogo Tester', phone: '9876543210', street: '1 Test St', city: 'Jaipur', state: 'Rajasthan', zip: '302017', country: 'India' };
    const order = await call('POST', '/orders', T, { cartId: c.id, paymentMethod: 'COD', shippingAddress: addr });
    check('order placed', order.status === 201, order.data);
    if (order.data?.order) {
      created.orders.push(order.data.order.id);
      const items = await prisma.orderItem.findMany({ where: { orderId: order.data.order.id } });
      const fi = items.filter((i) => i.metadata?.bogo === true);
      check('order contains the free item at 0', fi.length === 1 && fi[0].quantity === 1 && Number(fi[0].unitPrice) === 0, fi);
      check('free item keeps its variant on the order', fi[0] && fi[0].variantId === freeVariant);
      const after = await prisma.productVariant.findUnique({ where: { id: freeVariant } });
      check('stock reserved for the free unit too', after.reservedQuantity - before.reservedQuantity === 2, { before: before.reservedQuantity, after: after.reservedQuantity });
      check('order total = 3 paid units only', Number(order.data.order.subtotal) === 3100, order.data.order.subtotal);
      await call('PUT', `/orders/${order.data.order.id}/cancel`, T);
    }

    console.log('K. Checkout after the offer stopped applying');
    await clear();
    await add(S.id, 2);
    c = await cart();
    check('gift in cart before checkout', freeQty(c, F.id) === 1);
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { isActive: false } });
    const order2 = await call('POST', '/orders', T, { cartId: c.id, paymentMethod: 'COD', shippingAddress: addr });
    check('order still placed', order2.status === 201, order2.data);
    if (order2.data?.order) {
      created.orders.push(order2.data.order.id);
      const items = await prisma.orderItem.findMany({ where: { orderId: order2.data.order.id } });
      check('stale free item is not ordered', items.every((i) => i.metadata?.bogo !== true) && items.length === 1, items.map((i) => [i.productId === F.id ? 'gift' : 'paid', i.quantity]));
      await call('PUT', `/orders/${order2.data.order.id}/cancel`, T);
    }

    console.log('L. Offers changing while items sit in the cart (cart is re-checked when opened)');
    await clear();
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { isActive: false } });
    await add(S.id, 2);
    c = await cart();
    check('offer off: 2 in cart, no gift', freeQty(c, F.id) === 0);
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { isActive: true } });
    c = await cart();
    check('offer switched on -> opening the cart adds the gift', freeQty(c, F.id) === 1, free(c));
    await prisma.dynamicRule.updateMany({ where: { name: `${tag} buy2S-getF` }, data: { isActive: false } });
    c = await cart();
    check('offer switched off -> opening the cart removes the gift', freeQty(c, F.id) === 0, free(c));
  } finally {
    for (const id of created.orders) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.payment.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await prisma.cart.deleteMany({ where: { OR: [{ userId: buyer.id }, { sessionId: `${tag}-guest` }] } });
    await prisma.notification.deleteMany({ where: { userId: buyer.id } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId: buyer.id } });
    await prisma.dynamicRule.deleteMany({ where: { id: { in: created.rules } } });
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
