import { NextResponse } from "next/server"
import { getCategoryTree } from "@/modules/categories/service"

export async function GET() {
  try {
    const categories = await getCategoryTree()
    return NextResponse.json({ categories })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
