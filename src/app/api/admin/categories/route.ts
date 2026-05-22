import { NextRequest, NextResponse } from "next/server"
import { listCategories, createCategory } from "@/modules/categories/service"

export async function GET() {
  try {
    const categories = await listCategories(false)
    return NextResponse.json({ categories })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const category = await createCategory(body)
    return NextResponse.json({ category }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
