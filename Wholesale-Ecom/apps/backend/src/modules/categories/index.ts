import CategoryModuleService from "./services/category"
import { Module } from "@medusajs/framework/utils"
import Category from "./models/category"

export const CATEGORY_MODULE = "category"

export default Module(CATEGORY_MODULE, {
  service: CategoryModuleService,
  models: [Category],
})

export { CategoryModuleService as CategoryService }
