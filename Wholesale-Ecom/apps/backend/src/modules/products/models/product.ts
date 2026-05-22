import { model } from "@medusajs/framework/utils"
import Category from "../../categories/models/category"

const Product = model.define("Product", {
  id: model.id().primaryKey(),
  title: model.text().searchable(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  status: model.enum(["draft", "published", "archived"]).default("draft"),

  sku: model.text().nullable().searchable(),
  moq: model.number().default(1),
  weight: model.number().nullable(),
  dimensions: model.json().nullable(),

  category_id: model.text().nullable(),
  category: model.hasOne(() => Category, {
    mappedBy: "id",
    foreignKey: "category_id",
  }),

  variants: model.json().nullable(),
  images: model.json().nullable(),
  thumbnail: model.text().nullable(),

  unit_price: model.bigNumber().nullable(),
  compare_at_price: model.bigNumber().nullable(),

  inventory_quantity: model.number().default(0),
  allow_backorder: model.boolean().default(false),
  manage_inventory: model.boolean().default(true),

  tags: model.json().nullable(),
  metadata: model.json().nullable(),

  vendor_id: model.text().nullable(),
  vendor_name: model.text().nullable(),

  rating: model.number().default(0),
  review_count: model.number().default(0),
})

export default Product
