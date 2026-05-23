import { PrismaClient, UserRole, UserStatus, AccountType, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const COUPON_CODE = 'DEEPANSHU';
const COUPON_DISCOUNT_PERCENT = 10;

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@wholesalex.com';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        accountType: AccountType.LOCAL,
        emailVerified: true,
      },
    });
    console.log('✅ Admin user created: admin@wholesalex.com / Admin@123');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  await prisma.tierPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const electronics = await prisma.category.create({
    data: { name: 'Electronics', handle: 'electronics', description: 'Electronic devices and accessories', isActive: true, rank: 0 },
  });

  const fashion = await prisma.category.create({
    data: { name: 'Fashion', handle: 'fashion', description: 'Clothing and apparel', isActive: true, rank: 1 },
  });

  const industrial = await prisma.category.create({
    data: { name: 'Industrial', handle: 'industrial', description: 'Industrial tools and machinery', isActive: true, rank: 2 },
  });

  await prisma.product.create({
    data: {
      title: 'Wireless Earbuds Pro',
      handle: 'wireless-earbuds-pro',
      description: 'High-quality wireless earbuds with noise cancellation.',
      sku: 'WEP-001',
      moq: 10,
      unitPrice: 2500,
      compareAtPrice: 3000,
      inventoryQuantity: 500,
      status: ProductStatus.PUBLISHED,
      categoryId: electronics.id,
      vendorName: 'AudioTech Corp',
      tags: ['electronics', 'audio', 'wireless'],
      rating: 4.5,
      reviewCount: 12,
      tierPrices: {
        create: [
          { minQty: 10, maxQty: 49, price: 2400 },
          { minQty: 50, maxQty: 99, price: 2200 },
          { minQty: 100, price: 2000 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      title: 'Cotton T-Shirt Bulk',
      handle: 'cotton-t-shirt-bulk',
      description: 'Premium cotton t-shirts available in bulk.',
      sku: 'CTB-002',
      moq: 50,
      unitPrice: 150,
      compareAtPrice: 200,
      inventoryQuantity: 2000,
      status: ProductStatus.PUBLISHED,
      categoryId: fashion.id,
      vendorName: 'TextileHub India',
      tags: ['fashion', 'apparel', 'cotton'],
      rating: 4.2,
      reviewCount: 8,
      tierPrices: {
        create: [
          { minQty: 50, maxQty: 199, price: 140 },
          { minQty: 200, price: 120 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      title: 'Industrial Drill Machine',
      handle: 'industrial-drill-machine',
      description: 'Heavy-duty drill machine for industrial use.',
      sku: 'IDM-003',
      moq: 5,
      unitPrice: 12000,
      compareAtPrice: 15000,
      inventoryQuantity: 50,
      status: ProductStatus.PUBLISHED,
      categoryId: industrial.id,
      vendorName: 'ToolsMax Industries',
      tags: ['industrial', 'tools', 'machinery'],
      rating: 4.8,
      reviewCount: 5,
      tierPrices: {
        create: [
          { minQty: 5, maxQty: 19, price: 11500 },
          { minQty: 20, price: 11000 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      title: 'Smart LED Panel 24W',
      handle: 'smart-led-panel-24w',
      description: 'Energy-efficient LED panel for commercial spaces.',
      sku: 'SLP-004',
      moq: 20,
      unitPrice: 850,
      compareAtPrice: 1000,
      inventoryQuantity: 300,
      status: ProductStatus.PUBLISHED,
      categoryId: electronics.id,
      vendorName: 'BrightLight Solutions',
      tags: ['electronics', 'lighting', 'energy-saving'],
      rating: 4.3,
      reviewCount: 15,
      tierPrices: {
        create: [
          { minQty: 20, maxQty: 99, price: 800 },
          { minQty: 100, price: 750 },
        ],
      },
    },
  });

  // Upsert default coupon
  const now = new Date();
  const oneYearLater = new Date();
  oneYearLater.setFullYear(now.getFullYear() + 1);

  await prisma.coupon.upsert({
    where: { code: COUPON_CODE },
    update: {},
    create: {
      code: COUPON_CODE,
      type: 'PERCENTAGE',
      value: COUPON_DISCOUNT_PERCENT,
      isActive: true,
      startDate: now,
      endDate: oneYearLater,
    },
  });
  console.log(`✅ Coupon created: ${COUPON_CODE} (${COUPON_DISCOUNT_PERCENT}% off)`);

  console.log('✅ Seed complete: Categories and Products created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
