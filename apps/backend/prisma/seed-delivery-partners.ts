import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const partners = [
  { name: 'Delhivery', code: 'DELHIVERY', trackingUrlTemplate: 'https://www.delhivery.com/track/{trackingNumber}', contactEmail: 'support@delhivery.com', contactPhone: '0124-6719500' },
  { name: 'BlueDart', code: 'BLUEDART', trackingUrlTemplate: 'https://www.bluedart.com/tracking/{trackingNumber}', contactEmail: 'support@bluedart.com', contactPhone: '1860-233-1234' },
  { name: 'DTDC', code: 'DTDC', trackingUrlTemplate: 'https://www.dtdc.com/tracking.asp?Trkno={trackingNumber}', contactEmail: 'customercare@dtdc.com', contactPhone: '1800-123-4567' },
  { name: 'Ecom Express', code: 'ECOMEXPRESS', trackingUrlTemplate: 'https://ecomexpress.in/tracking/{trackingNumber}', contactEmail: 'cs@ecomexpress.in', contactPhone: '011-4290-3333' },
  { name: 'India Post', code: 'INDIAPOST', trackingUrlTemplate: 'https://www.indiapost.gov.in/vas/PTracking.asp?Trkno={trackingNumber}', contactEmail: '', contactPhone: '1800-266-6223' },
  { name: 'Professional Couriers', code: 'PROFCOURIERS', trackingUrlTemplate: 'https://www.tpcindia.com/tracking.aspx?awbno={trackingNumber}', contactEmail: '', contactPhone: '' },
  { name: 'Shadowfax', code: 'SHADOWFAX', trackingUrlTemplate: 'https://shadowfax.in/track/{trackingNumber}', contactEmail: '', contactPhone: '' },
  { name: 'Xpressbees', code: 'XPRESSBEES', trackingUrlTemplate: 'https://www.xpressbees.com/track/{trackingNumber}', contactEmail: '', contactPhone: '' },
];

async function main() {
  console.log('Seeding delivery partners...');
  for (const p of partners) {
    await prisma.deliveryPartner.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, isActive: true },
    });
  }
  console.log(`Seeded ${partners.length} delivery partners.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });