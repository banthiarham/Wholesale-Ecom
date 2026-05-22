import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductService from "../../../../modules/products/services/product"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  const { handle } = req.params

  const products = await productService.listProducts({
    where: { handle },
    take: 1,
  })

  if (!products.length) {
    return res.status(404).json({ message: "Product not found" })
  }

  return res.json({ product: products[0] })
}
