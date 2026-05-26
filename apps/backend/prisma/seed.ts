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

  // Create buyer users for reviews
  const buyer1Email = 'buyer1@wholesalex.com';
  let buyer1 = await prisma.user.findUnique({ where: { email: buyer1Email } });
  if (!buyer1) {
    const hashedPassword = await bcrypt.hash('Buyer1@123', 10);
    buyer1 = await prisma.user.create({
      data: {
        email: buyer1Email,
        password: hashedPassword,
        firstName: 'Rahul',
        lastName: 'Sharma',
        role: UserRole.BUYER,
        status: UserStatus.ACTIVE,
        accountType: AccountType.LOCAL,
        emailVerified: true,
      },
    });
    console.log('✅ Buyer1 user created: buyer1@wholesalex.com / Buyer1@123');
  } else {
    console.log('ℹ️ Buyer1 user already exists');
  }

  const buyer2Email = 'buyer2@wholesalex.com';
  let buyer2 = await prisma.user.findUnique({ where: { email: buyer2Email } });
  if (!buyer2) {
    const hashedPassword = await bcrypt.hash('Buyer2@123', 10);
    buyer2 = await prisma.user.create({
      data: {
        email: buyer2Email,
        password: hashedPassword,
        firstName: 'Priya',
        lastName: 'Patel',
        role: UserRole.BUYER,
        status: UserStatus.ACTIVE,
        accountType: AccountType.LOCAL,
        emailVerified: true,
      },
    });
    console.log('✅ Buyer2 user created: buyer2@wholesalex.com / Buyer2@123');
  } else {
    console.log('ℹ️ Buyer2 user already exists');
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

  const earbuds = await prisma.product.create({
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
      thumbnail: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop',
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

  const tshirt = await prisma.product.create({
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
      thumbnail: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1521572163474-6864f9d17fda?w=800&h=800&fit=crop',
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

  const drill = await prisma.product.create({
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
      thumbnail: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1504328347081-2a6f6c894568?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1581092914488-8f22e2e4a0f1?w=800&h=800&fit=crop',
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

  const ledPanel = await prisma.product.create({
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
      thumbnail: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&h=400&fit=crop',
      images: [
        'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=800&fit=crop',
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

  // Create reviews for each product
  await prisma.review.deleteMany();

  await prisma.review.createMany({
    data: [
      // Wireless Earbuds Pro reviews
      { productId: earbuds.id, userId: buyer1.id, rating: 5, title: 'Excellent noise cancellation', body: 'Best earbuds I have used for our office bulk order. Great ANC and battery life. Highly recommend for corporate purchases.', isVerified: true, helpful: 8 },
      { productId: earbuds.id, userId: buyer2.id, rating: 4, title: 'Good value for bulk purchase', body: 'Sound quality is impressive for the price. Ordered 50 units for our team and everyone is happy. Minor issue with the charging case but overall solid.', isVerified: true, helpful: 5 },

      // Cotton T-Shirt Bulk reviews
      { productId: tshirt.id, userId: buyer1.id, rating: 4, title: 'Great quality cotton', body: 'Very soft fabric and good stitching. We ordered 200 pieces for our company uniforms. Colors stay vibrant after multiple washes.', isVerified: true, helpful: 12 },
      { productId: tshirt.id, userId: buyer2.id, rating: 4, title: 'Comfortable and durable', body: 'Perfect for bulk orders. The MOQ of 50 is reasonable. Sizing is consistent across the batch which is important for uniform orders.', isVerified: true, helpful: 7 },

      // Industrial Drill Machine reviews
      { productId: drill.id, userId: buyer1.id, rating: 5, title: 'Powerful and reliable', body: 'This drill handles heavy-duty industrial work without breaking a sweat. We bought 10 units for our factory floor and they perform flawlessly every day.', isVerified: true, helpful: 15 },
      { productId: drill.id, userId: buyer2.id, rating: 5, title: 'Best industrial drill we have used', body: 'Excellent build quality and motor power. The tier pricing for 20+ units makes it very cost-effective. Highly recommended for manufacturing units.', isVerified: true, helpful: 10 },

      // Smart LED Panel 24W reviews
      { productId: ledPanel.id, userId: buyer1.id, rating: 4, title: 'Bright and energy efficient', body: 'Replaced all our office lights with these panels. Energy consumption dropped by 40%. Good quality light with no flickering.', isVerified: true, helpful: 9 },
      { productId: ledPanel.id, userId: buyer2.id, rating: 5, title: 'Perfect for commercial spaces', body: 'We installed 100 panels across our warehouse. Excellent brightness distribution and very low maintenance. The bulk discount at 100+ units is great.', isVerified: true, helpful: 11 },
    ],
  });
  console.log('✅ Reviews created: 2 reviews per product');

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
