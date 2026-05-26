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

  // Create vendor user
  const vendorEmail = 'vendor@wholesalex.com';
  const existingVendor = await prisma.user.findUnique({
    where: { email: vendorEmail },
  });

  let vendorUser = existingVendor;
  if (!existingVendor) {
    const hashedPassword = await bcrypt.hash('Vendor@123', 10);
    vendorUser = await prisma.user.create({
      data: {
        email: vendorEmail,
        password: hashedPassword,
        firstName: 'Demo',
        lastName: 'Vendor',
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        accountType: AccountType.LOCAL,
        emailVerified: true,
        companyName: 'Demo Vendor Pvt Ltd',
      },
    });
    console.log('✅ Vendor user created: vendor@wholesalex.com / Vendor@123');
  } else {
    console.log('ℹ️ Vendor user already exists');
  }

  await prisma.cartItem.deleteMany();
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
      vendorId: vendorUser.id,
      vendorName: 'AudioTech Corp',
      thumbnail: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1572569511254-d8f67fd68421?w=800&h=800&fit=crop',
      ],
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
      vendorId: vendorUser.id,
      vendorName: 'TextileHub India',
      thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9d17fda?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9d17fda?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&h=800&fit=crop',
      ],
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
      vendorId: vendorUser.id,
      vendorName: 'ToolsMax Industries',
      thumbnail: 'https://images.unsplash.com/photo-1504148455328-c376907d4914?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1504148455328-c376907d4914?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1530124566582-a45a7e3d0c71?w=800&h=800&fit=crop',
      ],
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
      vendorId: vendorUser.id,
      vendorName: 'BrightLight Solutions',
      thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1530536183495-732475a0d0d5?w=800&h=800&fit=crop',
      ],
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
