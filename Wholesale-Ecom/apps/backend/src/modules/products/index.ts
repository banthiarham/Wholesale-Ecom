import ProductModuleService from "./services/product"
import { Module } from "@medusajs/framework/utils"
import Product from "./models/product"

export const PRODUCT_MODULE = "product"

export default Module(PRODUCT_MODULE, {
  service: ProductModuleService,
  models: [Product],
})

export { ProductModuleService as ProductService }
