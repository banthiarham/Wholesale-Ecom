/* eslint-disable */
/**
 * Demo ledger history for ONE client: ~6 months of orders, payments (bank transfer, UPI, COD, credit),
 * a return with a refund, a replacement, a cancelled order and wallet credit use / repayment.
 * Only that client's demo records are touched; re-running replaces them (nothing else is changed —
 * no stock is reserved or released).
 *
 * Run inside the backend container:
 *   docker cp apps/backend/prisma/seed-ledger-demo.js wholesale-backend-1:/app/prisma/
 *   docker exec wholesale-backend-1 node prisma/seed-ledger-demo.js --yes [--email someone@example.com]
 *   docker exec wholesale-backend-1 node prisma/seed-ledger-demo.js --remove [--email …]   (delete the demo records only)
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const TAG = '[demo-ledger]';
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const EMAIL = arg('--email', 'vikram.mehta@example.com');
const round2 = (n) => Math.round(n * 100) / 100;
const at = (s) => new Date(`${s}T11:00:00+05:30`);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Each order: date, lines [sku, qty], how it was paid and where it stands now.
const ORDERS = [
  { date: '2026-06-05', lines: [['MOB-XIA-RN13-6128', 20], ['AUD-BOT-AD141', 50]], pay: 'BANK_TRANSFER', payStatus: 'CAPTURED', paidAfter: 2, status: 'DELIVERED' },
  { date: '2026-06-22', lines: [['MOB-APL-IP15-128', 10]], pay: 'BANK_TRANSFER', payStatus: 'CAPTURED', paidAfter: 1, status: 'DELIVERED' },
  { date: '2026-07-10', lines: [['ACC-AMB-GAN65', 100], ['CMP-LOG-M331', 40]], pay: 'UPI', payStatus: 'CAPTURED', paidAfter: 0, status: 'DELIVERED',
    returnOf: { sku: 'CMP-LOG-M331', qty: 10, after: 9, reason: 'Defective — left click not working', refund: true } },
  { date: '2026-08-02', lines: [['CMP-HP-15S-R5', 5], ['CMP-DEL-3520-I3', 5]], pay: 'WALLET', payStatus: 'CAPTURED', paidAfter: 0, status: 'DELIVERED',
    repay: { after: 28, note: 'Credit repayment received by NEFT (UTR HDFCN52608301234)' } },
  { date: '2026-09-18', lines: [['WRB-NOI-CFP5', 20], ['AUD-JBL-FLIP6', 6]], pay: 'COD', payStatus: 'CAPTURED', paidAfter: 4, status: 'DELIVERED',
    replacementOf: { sku: 'AUD-JBL-FLIP6', qty: 1, after: 8, reason: 'Speaker not charging — replacement sent' } },
  { date: '2026-10-08', lines: [['TV-SAM-55CU8000', 3], ['SMH-GGL-NESTMINI', 10]], pay: 'BANK_TRANSFER', payStatus: 'PENDING', paidAfter: 0, status: 'DELIVERED' },
  { date: '2026-10-25', lines: [['MOB-SAM-A35-8128', 15]], pay: 'BANK_TRANSFER', payStatus: 'CANCELLED', paidAfter: 0, status: 'CANCELLED', note: 'Cancelled by customer before dispatch' },
  { date: '2026-11-12', lines: [['AUD-APL-APP2', 10], ['AUD-SNY-CH720N', 20]], pay: 'WALLET', payStatus: 'CAPTURED', paidAfter: 0, status: 'PROCESSING' },
];

async function removeDemo(user) {
  const orders = await prisma.order.findMany({ where: { userId: user.id, notes: { contains: TAG } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    await prisma.returnRequest.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } }); // items, payment and refunds go with the order
  }
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (wallet) {
    await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id, createdBy: TAG } });
    // Balance = what is left from the client's own (non-demo) wallet history.
    const last = await prisma.walletTransaction.findFirst({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' } });
    await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: last ? last.balance : 0 } });
  }
  return ids.length;
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, include: { roleRel: true, addresses: true } });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  if (args.includes('--remove')) {
    console.log(`removed ${await removeDemo(user)} demo orders for ${EMAIL}`);
    return;
  }
  if (!args.includes('--yes')) {
    console.error(`Adds demo ledger history for ${EMAIL} (replacing earlier demo records for them). Re-run with --yes.`);
    process.exit(1);
  }
  await removeDemo(user);

  const settings = Object.fromEntries((await prisma.siteSetting.findMany()).map((s) => [s.key, s.value]));
  const sellerState = settings.businessState || '';
  const roundOff = settings.roundOffEnabled === 'true';
  const addr = user.addresses.find((a) => a.isDefault) || user.addresses[0];
  const shipTo = {
    fullName: `${user.firstName} ${user.lastName}`, phone: user.phone || '', email: user.email,
    street: addr?.street || user.companyAddress || '', city: addr?.city || user.city || '', state: addr?.state || user.state || '',
    zip: addr?.zip || user.pincode || '', country: addr?.country || 'India', company: user.companyName || undefined, gstin: user.gstin || undefined,
  };
  const igst = !!sellerState && !!shipTo.state && sellerState !== shipTo.state;

  const gateways = await prisma.paymentGateway.findMany({ where: { isActive: true } });
  const gatewayId = (provider) => gateways.find((g) => g.provider === provider)?.id || null;

  let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) wallet = await prisma.wallet.create({ data: { userId: user.id, balance: 0, creditLimit: 500000 } });
  let balance = Number(wallet.balance);
  const walletTx = async (type, amount, date, description, referenceId) => {
    balance = round2(type === 'DEBIT' ? balance - amount : balance + amount);
    await prisma.walletTransaction.create({ data: { walletId: wallet.id, type, amount, balance, description, referenceId, createdBy: TAG, createdAt: date } });
  };

  // This client's price for a product at a quantity: their role price tier, else bulk tier, else base price.
  const priceFor = async (product, qty) => {
    if (user.roleId) {
      const rp = await prisma.rolePrice.findFirst({ where: { productId: product.id, roleId: user.roleId, isActive: true, minQty: { lte: qty } }, orderBy: { minQty: 'desc' } });
      if (rp) return Number(rp.price);
    }
    const tier = await prisma.tierPrice.findFirst({ where: { productId: product.id, minQty: { lte: qty } }, orderBy: { minQty: 'desc' } });
    return tier ? Number(tier.price) : Number(product.unitPrice);
  };

  let invoiceSeq = 101;
  const created = [];
  for (const o of ORDERS) {
    const date = at(o.date);
    const items = [];
    for (const [sku, qty] of o.lines) {
      const product = await prisma.product.findUnique({ where: { sku } });
      if (!product) throw new Error(`Product ${sku} not found — run seed-electronics.js first`);
      const unitPrice = await priceFor(product, qty);
      items.push({ product, quantity: qty, unitPrice, totalPrice: round2(unitPrice * qty) });
    }
    const subtotal = round2(items.reduce((s, i) => s + i.totalPrice, 0));
    const tax = round2(subtotal * 0.18);
    const shipping = subtotal >= 50000 ? 0 : 499;
    const raw = round2(subtotal + tax + shipping);
    const total = roundOff ? Math.round(raw) : raw;
    const invoiceNumber = o.status === 'CANCELLED' ? null : `WC/26-27/${String(invoiceSeq++).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        status: o.status,
        totalAmount: total, subtotal, taxAmount: tax,
        cgstAmount: igst ? 0 : round2(tax / 2), sgstAmount: igst ? 0 : round2(tax / 2), igstAmount: igst ? tax : 0,
        shippingAmount: shipping, discountAmount: 0, roundOffAmount: round2(total - raw),
        currency: 'INR', shippingAddress: shipTo, billingAddress: shipTo,
        notes: [o.note, TAG].filter(Boolean).join(' '),
        invoiceNumber,
        deliveredAt: o.status === 'DELIVERED' ? addDays(date, 5) : null,
        createdAt: date,
        items: { create: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })) },
      },
      include: { items: true },
    });

    const payDate = addDays(date, o.paidAfter);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id, provider: o.pay, gatewayId: gatewayId(o.pay), amount: total, status: o.payStatus,
        providerRef: o.payStatus === 'CAPTURED' && o.pay !== 'COD' && o.pay !== 'WALLET' ? `DEMO${order.id.slice(0, 8).toUpperCase()}` : null,
        createdAt: payDate,
      },
    });
    const label = invoiceNumber || order.orderNumber.slice(0, 8).toUpperCase();
    if (o.pay === 'WALLET') await walletTx('DEBIT', total, date, `Order ${label} paid on credit`, order.id);
    if (o.repay) await walletTx('CREDIT', total, addDays(date, o.repay.after), o.repay.note, order.id);

    for (const r of [o.returnOf && { ...o.returnOf, type: 'RETURN' }, o.replacementOf && { ...o.replacementOf, type: 'REPLACEMENT' }].filter(Boolean)) {
      const line = order.items.find((i) => items.find((x) => x.product.id === i.productId)?.product.sku === r.sku);
      const value = round2(Number(line.unitPrice) * r.qty * 1.18);
      const when = addDays(date, r.after);
      await prisma.returnRequest.create({
        data: {
          orderId: order.id, userId: user.id, status: 'COMPLETED', type: r.type, reason: r.reason,
          refundAmount: r.type === 'RETURN' ? value : null, adminRemarks: r.type === 'RETURN' ? 'Units received and checked; refund issued.' : 'Replacement unit dispatched.',
          createdAt: when,
          items: { create: [{ orderItemId: line.id, quantity: r.qty, reason: r.reason }] },
          statusHistory: { create: [
            { status: 'REQUESTED', createdAt: when },
            { status: 'APPROVED', createdAt: addDays(when, 1) },
            { status: 'COMPLETED', createdAt: addDays(when, 6) },
          ] },
        },
      });
      if (r.refund) {
        await prisma.refund.create({ data: { paymentId: payment.id, amount: value, isPartial: true, reason: r.reason, status: 'PROCESSED', initiatedBy: 'admin', createdAt: addDays(when, 6) } });
      }
    }
    created.push(`${o.date}  ${o.status.padEnd(10)} ${o.pay.padEnd(13)} ${o.payStatus.padEnd(9)} ₹${total.toLocaleString('en-IN')}`);
  }
  await prisma.wallet.update({ where: { id: wallet.id }, data: { balance } });

  console.log(`Demo ledger for ${user.firstName} ${user.lastName} (${EMAIL})${user.roleRel ? ` — ${user.roleRel.label} prices` : ''}, ${igst ? 'IGST' : 'CGST+SGST'}:`);
  for (const c of created) console.log('  ' + c);
  console.log(`  wallet balance now ₹${balance.toLocaleString('en-IN')} (negative = credit used)`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
