import { prisma } from "@/lib/prisma"

export interface ProductFilters {
  categoryId?: string
  vendorId?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  moq?: number
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  search?: string
  tags?: string[]
}

export async function listProducts(filters?: ProductFilters) {
  const where: any = {}

  if (filters?.status) {
    where.status = filters.status
  } else {
    where.status = "PUBLISHED"
  }

  if (filters?.categoryId) {
    where.categoryId = filters.categoryId
  }

  if (filters?.vendorId) {
    where.vendorId = filters.vendorId
  }

  if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
    where.unitPrice = {}
    if (filters.minPrice !== undefined) where.unitPrice.gte = filters.minPrice
    if (filters.maxPrice !== undefined) where.unitPrice.lte = filters.maxPrice
  }

  if (filters?.inStock) {
    where.inventoryQuantity = { gt: 0 }
  }

  if (filters?.moq !== undefined) {
    where.moq = { lte: filters.moq }
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  if (filters?.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags }
  }

  return prisma.product.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, handle: true } },
      tierPrices: { orderBy: { minQty: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}

export async function getProductByHandle(handle: string) {
  return prisma.product.findUnique({
    where: { handle },
    include: {
      category: { select: { id: true, name: true, handle: true } },
      tierPrices: { orderBy: { minQty: "asc" } },
      reviews: {
        where: { isVerified: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  })
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, handle: true } },
      tierPrices: { orderBy: { minQty: "asc" } },
    },
  })
}

export async function createProduct(data: any) {
  return prisma.product.create({
    data: {
      ...data,
      tierPrices: data.tierPrices
        ? { create: data.tierPrices }
        : undefined,
    },
    include: {
      category: { select: { id: true, name: true, handle: true } },
      tierPrices: true,
    },
  })
}

export async function updateProduct(id: string, data: any) {
  return prisma.product.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true, handle: true } },
      tierPrices: true,
    },
  })
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } })
}

export async function listVendors() {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    select: { vendorId: true, vendorName: true },
    distinct: ["vendorId"],
  })
  return products.filter((p) => p.vendorId && p.vendorName)
}
