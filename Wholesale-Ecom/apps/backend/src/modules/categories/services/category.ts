import { MedusaService } from "@medusajs/framework/utils"
import Category from "../models/category"

class CategoryService extends MedusaService({
  Category,
}) {
  async listActive() {
    return this.listCategories({
      where: { is_active: true },
      order: { rank: "ASC" },
    })
  }

  async listTree() {
    const categories = await this.listActive()
    const map = new Map<string, any>()
    const roots: any[] = []

    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] })
    }

    for (const cat of categories) {
      const node = map.get(cat.id)
      if (cat.parent_category_id && map.has(cat.parent_category_id)) {
        map.get(cat.parent_category_id).children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  }

  async findByHandle(handle: string) {
    return this.listCategories({
      where: { handle },
      take: 1,
    }).then((res) => res[0])
  }
}

export default CategoryService
