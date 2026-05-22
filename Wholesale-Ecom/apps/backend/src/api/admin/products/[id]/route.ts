import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductService from "../../../../modules/products/services/product"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  const product = await productService.retrieveProduct(req.params.id)
  return res.json({ product })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  const product = await productService.updateProducts(req.params.id, req.body as any)
  return res.json({ product })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  await productService.deleteProducts(req.params.id)
  return res.status(204).send()
}
