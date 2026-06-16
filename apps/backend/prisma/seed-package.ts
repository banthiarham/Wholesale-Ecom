import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Seeding demo package...');

  // Check if demo package already exists
  const existing = await prisma.packageTemplate.findUnique({ where: { handle: 'custom-desktop-pc' } });
  if (existing) {
    console.log('✅ Demo package already exists, skipping.');
    process.exit(0);
  }

  // Get all published products (with or without category)
  const allProducts = await prisma.product.findMany({
    where: { status: ProductStatus.PUBLISHED },
    take: 20,
  });

  if (allProducts.length < 3) {
    console.log('❌ Need at least 3 published products to create a package. Please seed products first.');
    process.exit(1);
  }

  // Get categories that have published products
  const categories = await prisma.category.findMany({
    where: {
      products: { some: { status: ProductStatus.PUBLISHED } },
    },
  });

  // Build group data: use categories where possible, fall back to product-only groups
  type GroupData = {
    name: string;
    description: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    sortOrder: number;
    discountType?: string;
    discountValue?: number;
    maxDiscount?: number;
    categoryId?: string;
    productIds?: string[];
  };

  const groups: GroupData[] = [];

  if (categories.length >= 2) {
    // Use categories for groups
    const groupConfigs = [
      { name: 'Monitor', desc: 'Choose your display', discountType: 'PERCENTAGE' as const, discountValue: 10, maxDiscount: 5000 },
      { name: 'Processor', desc: 'Pick your CPU', discountType: undefined, discountValue: undefined, maxDiscount: undefined },
      { name: 'RAM', desc: 'Select memory', discountType: 'FLAT' as const, discountValue: 500, maxDiscount: undefined },
    ];

    for (let i = 0; i < Math.min(groupConfigs.length, categories.length); i++) {
      const config = groupConfigs[i];
      const cat = categories[i];
      const catProducts = allProducts.filter(p => p.categoryId === cat.id);
      groups.push({
        name: config.name,
        description: config.desc,
        required: i < 2,
        minSelect: 1,
        maxSelect: i === 2 ? 2 : 1,
        sortOrder: i,
        discountType: config.discountType,
        discountValue: config.discountValue,
        maxDiscount: config.maxDiscount,
        categoryId: cat.id,
        productIds: catProducts.length > 0 ? undefined : allProducts.slice(i * 3, i * 3 + 5).map(p => p.id),
      });
    }
  } else {
    // No categories with products — use explicit product lists
    const chunk = (arr: any[], size: number) => {
      const result = [];
      for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
      return result;
    };
    const chunks = chunk(allProducts, Math.ceil(allProducts.length / 3));

    const groupConfigs = [
      { name: 'Component A', desc: 'Choose your first component', required: true, discount: { type: 'PERCENTAGE' as const, value: 10, max: 5000 } },
      { name: 'Component B', desc: 'Choose your second component', required: true, discount: undefined },
      { name: 'Component C', desc: 'Optional upgrade', required: false, discount: { type: 'FLAT' as const, value: 500, max: undefined } },
    ];

    for (let i = 0; i < Math.min(groupConfigs.length, chunks.length); i++) {
      const config = groupConfigs[i];
      groups.push({
        name: config.name,
        description: config.desc,
        required: config.required,
        minSelect: config.required ? 1 : 0,
        maxSelect: i === 2 ? 2 : 1,
        sortOrder: i,
        discountType: config.discount?.type,
        discountValue: config.discount?.value,
        maxDiscount: config.discount?.max,
        productIds: chunks[i].map(p => p.id),
      });
    }
  }

  // Ensure at least 2 groups
  if (groups.length < 2) {
    console.log('❌ Need at least 2 groups. Not enough products or categories.');
    process.exit(1);
  }

  // Create the package template
  const pkg = await prisma.packageTemplate.create({
    data: {
      title: 'Custom Desktop PC',
      handle: 'custom-desktop-pc',
      description: 'Build your perfect desktop PC by choosing your own monitor, processor, and RAM. Each component group offers the best options from our catalog with exclusive package discounts.',
      basePrice: 5000,
      status: ProductStatus.PUBLISHED,
      groups: {
        create: groups.map((g) => {
          const { productIds, ...groupData } = g;
          return {
            ...groupData,
            products: productIds
              ? {
                  create: productIds.map((pid, j) => ({
                    productId: pid,
                    sortOrder: j,
                    isDefault: j === 0,
                  })),
                }
              : undefined,
          };
        }),
      },
    },
    include: { groups: { include: { products: { include: { product: true } } } } },
  });

  console.log(`✅ Demo package created: "${pkg.title}" (${pkg.handle})`);
  console.log(`   Groups: ${pkg.groups.map((g) => g.name).join(', ')}`);
  for (const group of pkg.groups) {
    console.log(`   ${group.name}: ${group.products.length} products${group.categoryId ? ` (category: ${group.categoryId})` : ' (explicit)'}${group.discountType ? `, ${group.discountType} ${group.discountValue} discount` : ''}`);
  }
  console.log(`   Status: ${pkg.status}`);
  console.log(`   Base Price: ₹${Number(pkg.basePrice).toLocaleString('en-IN')}`);

  // Link a product to this package template via metadata so storefront can find it
  const anchorProduct = allProducts[0];
  if (anchorProduct) {
    const existingMeta = (typeof anchorProduct.metadata === 'object' && anchorProduct.metadata ? anchorProduct.metadata : {}) as Record<string, any>;
    await prisma.product.update({
      where: { id: anchorProduct.id },
      data: {
        metadata: { ...existingMeta, packageTemplateId: pkg.id },
      },
    });
    console.log(`\n🔗 Linked product "${anchorProduct.title}" to this package`);
    console.log(`   Visit /products/${anchorProduct.handle} to see the configurator`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });