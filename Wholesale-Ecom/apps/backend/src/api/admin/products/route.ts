import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductService from "../../../modules/products/services/product"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  const products = await productService.listProducts({ take: 100 })
  return res.json({ products })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  const product = await productService.createProducts(req.body as any)
  return res.status(201).json({ product })
}
