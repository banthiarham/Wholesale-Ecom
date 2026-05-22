import { ExecArgs } from "@medusajs/framework/types"
import ProductService from "../modules/products/services/product"
import CategoryService from "../modules/categories/services/category"

export default async function seed({ container }: ExecArgs) {
  const categoryService: CategoryService = container.resolve("category")
  const productService: ProductService = container.resolve("product")

  const electronics = await categoryService.createCategories({
    name: "Electronics",
    handle: "electronics",
    description: "Electronic devices and accessories",
    is_active: true,
    rank: 0,
  })

  const fashion = await categoryService.createCategories({
    name: "Fashion",
    handle: "fashion",
    description: "Clothing and apparel",
    is_active: true,
    rank: 1,
  })

  const industrial = await categoryService.createCategories({
    name: "Industrial",
    handle: "industrial",
    description: "Industrial tools and machinery",
    is_active: true,
    rank: 2,
  })

  await productService.createProducts({
    title: "Wireless Earbuds Pro",
    handle: "wireless-earbuds-pro",
    description: "High-quality wireless earbuds with noise cancellation.",
    sku: "WEP-001",
    moq: 10,
    unit_price: 2500,
    compare_at_price: 3000,
    inventory_quantity: 500,
    status: "published",
    category_id: electronics.id,
    vendor_name: "AudioTech Corp",
    tags: ["electronics", "audio", "wireless"],
  })

  await productService.createProducts({
    title: "Cotton T-Shirt Bulk",
    handle: "cotton-t-shirt-bulk",
    description: "Premium cotton t-shirts available in bulk.",
    sku: "CTB-002",
    moq: 50,
    unit_price: 150,
    compare_at_price: 200,
    inventory_quantity: 2000,
    status: "published",
    category_id: fashion.id,
    vendor_name: "TextileHub India",
    tags: ["fashion", "apparel", "cotton"],
  })

  await productService.createProducts({
    title: "Industrial Drill Machine",
    handle: "industrial-drill-machine",
    description: "Heavy-duty drill machine for industrial use.",
    sku: "IDM-003",
    moq: 5,
    unit_price: 12000,
    compare_at_price: 15000,
    inventory_quantity: 50,
    status: "published",
    category_id: industrial.id,
    vendor_name: "ToolsMax Industries",
    tags: ["industrial", "tools", "machinery"],
  })

  console.log("Seed complete: Categories and Products created.")
}
