/* eslint-disable */
// Regression smoke test for the earlier features (everything except variants / buy-X-get-Y, which
// have their own suites): pricing privacy, cart repricing, return window, order detail access,
// admin users, products export source data, settings, simple-product purchase flow.
// Creates its own buyer + products and removes them. Run from apps/backend: node scripts/regression-smoke.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();
const tag = `rtest-${Date.now()}`;
let passed = 0;
const failures = [];
const check = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
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
  return { status: res.status, data };
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const AT = sign(admin);
  const buyer = await prisma.user.create({ data: { email: `${tag}@example.test`, firstName: 'Reg', lastName: 'Tester' } });
  const other = await prisma.user.create({ data: { email: `${tag}-o@example.test`, firstName: 'Other', lastName: 'Buyer' } });
  const BT = sign(buyer);
  const OT = sign(other);
  const created = { products: [], orders: [], contracts: [] };
  const addr = { fullName: 'Reg Tester', phone: '9876543210', street: '1 Test St', city: 'Jaipur', state: 'Rajasthan', zip: '302017', country: 'India' };

  try {
    const P = (await call('POST', '/products', AT, { title: `${tag} item`, handle: `${tag}-item`, sku: `${tag}-1`, moq: 1, unitPrice: 100, inventoryQuantity: 50, status: 'PUBLISHED' })).data.product;
    created.products.push(P.id);

    console.log('1. Products / settings');
    const list = await call('GET', '/products?limit=5');
    check('product list works', list.status === 200 && Array.isArray(list.data.products || list.data));
    const bySku = await call('GET', `/products?search=${tag}`);
    check('search finds the new product', JSON.stringify(bySku.data).includes(P.handle));
    const one = await call('GET', `/products/${P.handle}`);
    check('product page data (simple product)', one.data.product.hasVariants === false && one.data.product.variants.length === 0 && Number(one.data.product.unitPrice) === 100);
    const st = await call('GET', '/settings');
    check('settings include return window', st.status === 200 && st.data.settings.returnWindowDays !== undefined, st.data.settings && st.data.settings.returnWindowDays);
    const stBad = await call('PUT', '/settings', AT, { returnWindowDays: 'abc' });
    check('invalid return window rejected', stBad.status === 400, stBad.status);
    const stNon = await call('PUT', '/settings', BT, { returnWindowDays: '10' });
    check('non-admin cannot change settings', stNon.status === 403, stNon.status);

    console.log('2. Pricing privacy (contract price)');
    const cp = await prisma.contractPrice.create({ data: { productId: P.id, userId: buyer.id, price: 80, minQty: 1, isActive: true } });
    created.contracts.push(cp.id);
    const anon = await call('GET', `/pricing/calculate?productId=${P.id}&quantity=1&userId=${buyer.id}`);
    check('anonymous caller cannot read another user\'s contract price', anon.status === 200 && anon.data.finalPrice === 100, anon.data.finalPrice);
    const asOther = await call('GET', `/pricing/calculate?productId=${P.id}&quantity=1&userId=${buyer.id}`, OT);
    check('another buyer cannot read it by passing userId', asOther.data.finalPrice === 100, asOther.data.finalPrice);
    const asSelf = await call('GET', `/pricing/calculate?productId=${P.id}&quantity=1`, BT);
    check('the buyer gets the contract price', asSelf.data.finalPrice === 80 && asSelf.data.appliedRule === 'contract', asSelf.data);
    const asAdmin = await call('GET', `/pricing/calculate?productId=${P.id}&quantity=1&userId=${buyer.id}`, AT);
    check('admin can preview a user\'s price', asAdmin.data.finalPrice === 80, asAdmin.data.finalPrice);

    console.log('3. Cart repricing on load');
    await prisma.contractPrice.update({ where: { id: cp.id }, data: { isActive: false } });
    const add = await call('POST', '/cart', BT, { productId: P.id, quantity: 2 });
    check('add to cart at retail price', add.status === 201 || add.status === 200, add.data);
    const line = add.data.cart.items[0];
    check('cart line = 100 while no contract', Number(line.unitPrice) === 100, line.unitPrice);
    await prisma.contractPrice.update({ where: { id: cp.id }, data: { isActive: true } });
    const reload = await call('GET', '/cart', BT);
    check('contract price assigned later -> cart line refreshed to 80', Number(reload.data.cart.items[0].unitPrice) === 80, reload.data.cart.items[0].unitPrice);
    check('cart totals follow', Number(reload.data.totals.subtotal) === 160, reload.data.totals.subtotal);

    console.log('4. Order flow + order detail access');
    const order = await call('POST', '/orders', BT, { cartId: reload.data.cart.id, paymentMethod: 'COD', shippingAddress: addr });
    check('order placed', order.status === 201, order.data);
    const O = order.data.order;
    created.orders.push(O.id);
    check('order items keep the paid price', Number(O.items[0].unitPrice) === 80);
    const mine = await call('GET', `/orders/${O.id}`, BT);
    check('buyer can open own order', mine.status === 200 && mine.data.order.items.length === 1);
    const theirs = await call('GET', `/orders/${O.id}`, OT);
    check('another buyer cannot open it', theirs.status === 404, theirs.status);
    const adm = await call('GET', `/orders/${O.id}`, AT);
    check('admin can open any order (admin order page)', adm.status === 200 && adm.data.order.user && adm.data.order.user.email === buyer.email);
    const all = await call('GET', '/orders', AT);
    check('admin order list works', all.status === 200 && (all.data.orders || []).some((o) => o.id === O.id));
    const stock = await prisma.product.findUnique({ where: { id: P.id } });
    check('stock reserved for the order', stock.reservedQuantity === 2, stock.reservedQuantity);

    console.log('5. Order status, tracking, return window');
    const tr = await call('PUT', `/orders/${O.id}/tracking`, AT, { trackingNumber: 'TRK123', carrier: 'Test Carrier' });
    check('admin can save tracking', tr.status === 200, tr.data);
    const sh = await call('PUT', `/orders/${O.id}/status`, AT, { status: 'SHIPPED' });
    check('admin can mark shipped', sh.status === 200 && sh.data.order.status === 'SHIPPED');
    const early = await call('POST', '/returns', BT, { orderId: O.id, reason: 'x', items: [{ orderItemId: O.items[0].id, quantity: 1 }] });
    check('return refused before delivery', early.status === 400, early.status);
    const dl = await call('PUT', `/orders/${O.id}/status`, AT, { status: 'DELIVERED' });
    check('admin can mark delivered', dl.status === 200 && dl.data.order.status === 'DELIVERED');
    const afterDl = await prisma.order.findUnique({ where: { id: O.id } });
    check('delivery time recorded', !!afterDl.deliveredAt);
    // window: 15 days default; make delivery 20 days ago -> closed
    await prisma.order.update({ where: { id: O.id }, data: { deliveredAt: new Date(Date.now() - 20 * 864e5) } });
    const closed = await call('POST', '/returns', BT, { orderId: O.id, reason: 'late', items: [{ orderItemId: O.items[0].id, quantity: 1 }] });
    check('return refused after the window (20 days > 15)', closed.status === 400 && /window/i.test(JSON.stringify(closed.data)), closed.data);
    await prisma.order.update({ where: { id: O.id }, data: { deliveredAt: new Date(Date.now() - 2 * 864e5) } });
    const open = await call('POST', '/returns', BT, { orderId: O.id, reason: 'ok', items: [{ orderItemId: O.items[0].id, quantity: 1 }] });
    check('return accepted inside the window', open.status === 201, open.data);

    console.log('6. Admin users');
    const u = await call('GET', `/users/${buyer.id}`, AT);
    check('admin can open a user (detail page)', u.status === 200 && (u.data.user || u.data).email === buyer.email, u.status);
    const uNon = await call('GET', `/users/${buyer.id}`, OT);
    check('another buyer cannot open a user record', uNon.status === 403 || uNon.status === 404, uNon.status);
    const ul = await call('GET', '/users', AT);
    check('admin user list works', ul.status === 200);

    console.log('7. Core guards');
    const noAuthOrders = await call('GET', '/orders');
    check('orders need a login', noAuthOrders.status === 401, noAuthOrders.status);
    const noAuthProduct = await call('POST', '/products', null, { title: 'x' });
    check('creating products needs a login', noAuthProduct.status === 401, noAuthProduct.status);
    const buyerProduct = await call('POST', '/products', BT, { title: 'x', handle: `${tag}-nope`, moq: 1, unitPrice: 1, inventoryQuantity: 1 });
    check('buyers cannot create products', buyerProduct.status === 403, buyerProduct.status);
  } finally {
    for (const id of created.orders) {
      // Return requests (and their tickets, items, history) reference the order.
      await prisma.rmaTicket.deleteMany({ where: { orderId: id } });
      await prisma.returnRequest.deleteMany({ where: { orderId: id } });
      await prisma.deliveryTracking.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.payment.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch((e) => console.log('cleanup order failed', e.message));
    }
    for (const id of created.contracts) await prisma.contractPrice.delete({ where: { id } }).catch(() => {});
    await prisma.cart.deleteMany({ where: { userId: { in: [buyer.id, other.id] } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [buyer.id, other.id] } } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId: { in: [buyer.id, other.id] } } });
    for (const id of created.products) {
      await prisma.inventoryLog.deleteMany({ where: { productId: id } });
      await prisma.cartItem.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } }).catch((e) => console.log('cleanup product failed', e.message));
    }
    await prisma.user.deleteMany({ where: { id: { in: [buyer.id, other.id] } } }).catch((e) => console.log('cleanup user failed', e.message));
    await prisma.$disconnect();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log('Failed:', failures); process.exitCode = 1; }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
