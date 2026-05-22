import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import CategoryService from "../../../modules/categories/services/category"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  const categories = await categoryService.listTree()
  return res.json({ categories })
}
