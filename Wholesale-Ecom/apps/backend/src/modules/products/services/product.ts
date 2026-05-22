import { MedusaService } from "@medusajs/framework/utils"
import Product from "../models/product"

class ProductService extends MedusaService({
  Product,
}) {
  async searchProducts(query: string, filters?: Record<string, any>) {
    const productRepo = this.activeManager_.getRepository(Product)

    const qb = productRepo.createQueryBuilder("p")
      .where("p.status = :status", { status: "published" })
      .andWhere(
        `(p.title ILIKE :query OR p.description ILIKE :query OR p.sku ILIKE :query)`,
        { query: `%${query}%` }
      )

    if (filters?.category_id) {
      qb.andWhere("p.category_id = :category_id", { category_id: filters.category_id })
    }

    if (filters?.min_price) {
      qb.andWhere("p.unit_price >= :min_price", { min_price: filters.min_price })
    }

    if (filters?.max_price) {
      qb.andWhere("p.unit_price <= :max_price", { max_price: filters.max_price })
    }

    if (filters?.vendor_id) {
      qb.andWhere("p.vendor_id = :vendor_id", { vendor_id: filters.vendor_id })
    }

    if (filters?.in_stock) {
      qb.andWhere("p.inventory_quantity > 0")
    }

    if (filters?.moq) {
      qb.andWhere("p.moq <= :moq", { moq: filters.moq })
    }

    qb.orderBy("p.rating", "DESC")

    return qb.getMany()
  }

  async listByCategory(categoryId: string) {
    return this.listProducts({
      where: { category_id: categoryId, status: "published" },
    })
  }

  async listByVendor(vendorId: string) {
    return this.listProducts({
      where: { vendor_id: vendorId, status: "published" },
    })
  }
}

export default ProductService
