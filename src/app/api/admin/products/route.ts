import { NextRequest, NextResponse } from "next/server"
import { listProducts, createProduct } from "@/modules/products/service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") as any
    const products = await listProducts(status ? { status } : undefined)
    return NextResponse.json({ products })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const product = await createProduct(body)
    return NextResponse.json({ product }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
