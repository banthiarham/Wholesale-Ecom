import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  addItemToCart,
  getOrCreateCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  calculateCartTotals,
} from "@/modules/cart/service"

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
})

const updateSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const removeSchema = z.object({
  itemId: z.string().min(1),
})

function getSessionId(req: NextRequest): string {
  let sessionId = req.cookies.get("cart_session")?.value
  if (!sessionId) {
    sessionId = crypto.randomUUID()
  }
  return sessionId
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req)
    const userId = req.headers.get("x-user-id") || undefined

    const cart = await getOrCreateCart(userId, sessionId)
    const totals = calculateCartTotals(cart)

    const response = NextResponse.json({ cart, totals })
    response.cookies.set("cart_session", sessionId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    })

    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = addSchema.parse(body)
    const sessionId = body.sessionId || getSessionId(req)
    const userId = body.userId || req.headers.get("x-user-id") || undefined

    const cart = await addItemToCart(
      { productId: parsed.productId, quantity: parsed.quantity },
      userId,
      sessionId
    )
    const totals = calculateCartTotals(cart)

    const response = NextResponse.json({ cart, totals }, { status: 201 })
    if (!body.sessionId) {
      response.cookies.set("cart_session", sessionId, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      })
    }

    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = updateSchema.parse(body)

    const cart = await updateCartItem(parsed.itemId, parsed.quantity)
    const totals = calculateCartTotals(cart)

    return NextResponse.json({ cart, totals })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = removeSchema.parse(body)

    const cart = await removeCartItem(parsed.itemId)
    const totals = calculateCartTotals(cart)

    return NextResponse.json({ cart, totals })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
