import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductService from "../../../modules/products/services/product"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("product")
  const { q, category_id, vendor_id, min_price, max_price, in_stock, moq } = req.query as Record<string, string>

  if (q) {
    const results = await productService.searchProducts(q, {
      category_id,
      vendor_id,
      min_price: min_price ? parseFloat(min_price) : undefined,
      max_price: max_price ? parseFloat(max_price) : undefined,
      in_stock: in_stock === "true",
      moq: moq ? parseInt(moq) : undefined,
    })
    return res.json({ products: results })
  }

  const products = await productService.listProducts({
    where: { status: "published" },
    take: 50,
  })

  return res.json({ products })
}
