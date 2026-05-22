import { model } from "@medusajs/framework/utils"
import Product from "./product"

const Category = model.define("Category", {
  id: model.id().primaryKey(),
  name: model.text().searchable(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  is_active: model.boolean().default(true),
  rank: model.number().default(0),
  parent_category_id: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default Category
