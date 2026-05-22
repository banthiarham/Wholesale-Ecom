import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import CategoryService from "../../../../modules/categories/services/category"
import ProductService from "../../../../modules/products/services/product"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const categoryService: CategoryService = req.scope.resolve("category")
  const productService: ProductService = req.scope.resolve("product")
  const { handle } = req.params

  const category = await categoryService.findByHandle(handle)

  if (!category) {
    return res.status(404).json({ message: "Category not found" })
  }

  const products = await productService.listByCategory(category.id)

  return res.json({ category, products })
}
