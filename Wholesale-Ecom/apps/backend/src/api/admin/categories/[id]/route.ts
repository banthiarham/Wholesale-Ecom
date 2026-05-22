import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import CategoryService from "../../../../modules/categories/services/category"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  const category = await categoryService.retrieveCategory(req.params.id)
  return res.json({ category })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  const category = await categoryService.updateCategories(req.params.id, req.body as any)
  return res.json({ category })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  await categoryService.deleteCategories(req.params.id)
  return res.status(204).send()
}
