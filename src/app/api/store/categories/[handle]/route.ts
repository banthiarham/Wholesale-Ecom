import { NextResponse } from "next/server"
import { getCategoryByHandle } from "@/modules/categories/service"

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const category = await getCategoryByHandle(params.handle)

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json({ category })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
