import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import CategoryService from "../../../modules/categories/services/category"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  const categories = await categoryService.listCategories({ take: 100 })
  return res.json({ categories })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  const category = await categoryService.createCategories(req.body as any)
  return res.status(201).json({ category })
}
