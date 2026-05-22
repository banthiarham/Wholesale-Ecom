import { NextRequest, NextResponse } from "next/server"
import { getCategoryById, updateCategory, deleteCategory } from "@/modules/categories/service"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const category = await getCategoryById(params.id)
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }
    return NextResponse.json({ category })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const category = await updateCategory(params.id, body)
    return NextResponse.json({ category })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteCategory(params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
