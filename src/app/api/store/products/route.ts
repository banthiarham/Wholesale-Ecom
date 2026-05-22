import { NextRequest, NextResponse } from "next/server"
import { listProducts } from "@/modules/products/service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const filters = {
      search: searchParams.get("q") || undefined,
      categoryId: searchParams.get("category") || undefined,
      vendorId: searchParams.get("vendor") || undefined,
      minPrice: searchParams.get("min_price")
        ? parseFloat(searchParams.get("min_price")!)
        : undefined,
      maxPrice: searchParams.get("max_price")
        ? parseFloat(searchParams.get("max_price")!)
        : undefined,
      inStock: searchParams.get("in_stock") === "true",
      moq: searchParams.get("moq")
        ? parseInt(searchParams.get("moq")!)
        : undefined,
      tags: searchParams.get("tags")
        ? searchParams.get("tags")!.split(",")
        : undefined,
    }

    const products = await listProducts(filters)
    return NextResponse.json({ products, count: products.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
