import { prisma } from "@/lib/prisma"

export async function listCategories(activeOnly = true) {
  return prisma.category.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { rank: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  })
}

export async function getCategoryTree() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { rank: "asc" },
    include: {
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
    },
  })

  const map = new Map<string, any>()
  const roots: any[] = []

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] })
  }

  for (const cat of categories) {
    const node = map.get(cat.id)
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export async function getCategoryByHandle(handle: string) {
  return prisma.category.findUnique({
    where: { handle },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
      },
      children: true,
    },
  })
}

export async function createCategory(data: any) {
  return prisma.category.create({ data })
}

export async function updateCategory(id: string, data: any) {
  return prisma.category.update({ where: { id }, data })
}

export async function deleteCategory(id: string) {
  return prisma.category.delete({ where: { id } })
}
