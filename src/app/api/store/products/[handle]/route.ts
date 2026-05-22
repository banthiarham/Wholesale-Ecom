import { NextResponse } from "next/server"
import { getProductByHandle } from "@/modules/products/service"

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const product = await getProductByHandle(params.handle)

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
