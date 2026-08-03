import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KEEP_CODES = ['SHIPROCKET', 'SHIPMOZO'];

const partners = [
  {
    name: 'Shiprocket',
    code: 'SHIPROCKET',
    trackingUrlTemplate: 'https://shiprocket.co/tracking/{trackingNumber}',
    contactEmail: 'support@shiprocket.in',
    contactPhone: '',
  },
  {
    name: 'Shipmozo',
    code: 'SHIPMOZO',
    trackingUrlTemplate: 'https://shipmozo.com/tracking/{trackingNumber}',
    contactEmail: 'support@shipmozo.com',
    contactPhone: '',
  },
];

async function main() {
  console.log('Seeding Shiprocket and Shipmozo delivery partners...');
  for (const p of partners) {
    await prisma.deliveryPartner.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, isActive: true },
    });
  }

  const shiprocket = await prisma.deliveryPartner.findUniqueOrThrow({ where: { code: 'SHIPROCKET' } });

  const stale = await prisma.deliveryPartner.findMany({ where: { code: { notIn: KEEP_CODES } } });
  if (stale.length === 0) {
    console.log('No old dummy delivery partners found — nothing to remove.');
  } else {
    console.log(`Found ${stale.length} old delivery partner(s) to remove: ${stale.map((p) => `${p.name} (${p.code})`).join(', ')}`);
  }

  for (const partner of stale) {
    const referencingOrders = await prisma.order.findMany({ where: { deliveryPartnerId: partner.id } });

    if (referencingOrders.length > 0) {
      console.log(`  ${partner.code} is referenced by ${referencingOrders.length} order(s). Migrating to Shiprocket (tracking number/status/events are preserved, only the partner link changes)...`);
      for (const order of referencingOrders) {
        await prisma.order.update({
          where: { id: order.id },
          data: { deliveryPartnerId: shiprocket.id, carrier: shiprocket.name },
        });
        console.log(`    Order ${order.orderNumber} -> Shiprocket`);
      }
    }

    const referencingLogCount = await prisma.shipmentSyncLog.count({ where: { partnerId: partner.id } });
    if (referencingLogCount > 0) {
      console.warn(`  WARNING: ${partner.code} has ${referencingLogCount} shipment sync log(s). These are historical audit records tied to that specific provider and can't be safely reassigned. Skipping deletion of ${partner.code} — resolve manually if it must be removed.`);
      continue;
    }

    await prisma.deliveryPartner.delete({ where: { id: partner.id } });
    console.log(`  Deleted ${partner.code} (${partner.name}).`);
  }

  const remaining = await prisma.deliveryPartner.findMany({ select: { name: true, code: true } });
  console.log(`Final delivery partners (${remaining.length}): ${remaining.map((p) => `${p.name} (${p.code})`).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
