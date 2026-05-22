import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.category.deleteMany()
  await prisma.product.deleteMany()

  const electronics = await prisma.category.create({
    data: {
      name: "Electronics",
      handle: "electronics",
      description: "Electronic devices and accessories",
      isActive: true,
      rank: 0,
    },
  })

  const fashion = await prisma.category.create({
    data: {
      name: "Fashion",
      handle: "fashion",
      description: "Clothing and apparel",
      isActive: true,
      rank: 1,
    },
  })

  const industrial = await prisma.category.create({
    data: {
      name: "Industrial",
      handle: "industrial",
      description: "Industrial tools and machinery",
      isActive: true,
      rank: 2,
    },
  })

  await prisma.product.createMany({
    data: [
      {
        title: "Wireless Earbuds Pro",
        handle: "wireless-earbuds-pro",
        description: "High-quality wireless earbuds with noise cancellation.",
        sku: "WEP-001",
        moq: 10,
        unitPrice: 2500,
        compareAtPrice: 3000,
        inventoryQuantity: 500,
        status: "PUBLISHED",
        categoryId: electronics.id,
        vendorName: "AudioTech Corp",
        tags: ["electronics", "audio", "wireless"],
        rating: 4.5,
        reviewCount: 12,
      },
      {
        title: "Cotton T-Shirt Bulk",
        handle: "cotton-t-shirt-bulk",
        description: "Premium cotton t-shirts available in bulk.",
        sku: "CTB-002",
        moq: 50,
        unitPrice: 150,
        compareAtPrice: 200,
        inventoryQuantity: 2000,
        status: "PUBLISHED",
        categoryId: fashion.id,
        vendorName: "TextileHub India",
        tags: ["fashion", "apparel", "cotton"],
        rating: 4.2,
        reviewCount: 8,
      },
      {
        title: "Industrial Drill Machine",
        handle: "industrial-drill-machine",
        description: "Heavy-duty drill machine for industrial use.",
        sku: "IDM-003",
        moq: 5,
        unitPrice: 12000,
        compareAtPrice: 15000,
        inventoryQuantity: 50,
        status: "PUBLISHED",
        categoryId: industrial.id,
        vendorName: "ToolsMax Industries",
        tags: ["industrial", "tools", "machinery"],
        rating: 4.8,
        reviewCount: 5,
      },
      {
        title: "Smart LED Panel 24W",
        handle: "smart-led-panel-24w",
        description: "Energy-efficient LED panel for commercial spaces.",
        sku: "SLP-004",
        moq: 20,
        unitPrice: 850,
        compareAtPrice: 1000,
        inventoryQuantity: 300,
        status: "PUBLISHED",
        categoryId: electronics.id,
        vendorName: "BrightLight Solutions",
        tags: ["electronics", "lighting", "energy-saving"],
        rating: 4.3,
        reviewCount: 15,
      },
      {
        title: "Denim Jeans Wholesale",
        handle: "denim-jeans-wholesale",
        description: "Premium denim jeans in assorted sizes.",
        sku: "DJW-005",
        moq: 30,
        unitPrice: 450,
        compareAtPrice: 600,
        inventoryQuantity: 800,
        status: "PUBLISHED",
        categoryId: fashion.id,
        vendorName: "StyleMart Exports",
        tags: ["fashion", "denim", "apparel"],
        rating: 4.1,
        reviewCount: 6,
      },
    ],
  })

  console.log("Seed complete: 5 products and 3 categories created.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
