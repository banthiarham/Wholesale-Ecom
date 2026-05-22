import { prisma } from "@/lib/prisma"

export interface CartItemInput {
  productId: string
  quantity: number
}

export interface CartWithItems {
  id: string
  userId: string | null
  sessionId: string | null
  items: Array<{
    id: string
    quantity: number
    unitPrice: number
    product: {
      id: string
      title: string
      handle: string
      sku: string | null
      thumbnail: string | null
      moq: number
      inventoryQuantity: number
    }
  }>
}

export async function getOrCreateCart(userId?: string, sessionId?: string) {
  let cart = null

  if (userId) {
    cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                handle: true,
                sku: true,
                thumbnail: true,
                moq: true,
                inventoryQuantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    })
  }

  if (!cart && sessionId) {
    cart = await prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                handle: true,
                sku: true,
                thumbnail: true,
                moq: true,
                inventoryQuantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    })
  }

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId: userId || null, sessionId: sessionId || null },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                handle: true,
                sku: true,
                thumbnail: true,
                moq: true,
                inventoryQuantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    })
  }

  return cart
}

export async function addItemToCart(
  input: CartItemInput,
  userId?: string,
  sessionId?: string
) {
  const cart = await getOrCreateCart(userId, sessionId)
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  })

  if (!product) throw new Error("Product not found")
  if (product.status !== "PUBLISHED") throw new Error("Product is not available")
  if (input.quantity < product.moq) {
    throw new Error(`Minimum order quantity is ${product.moq}`)
  }
  if (product.manageInventory && input.quantity > product.inventoryQuantity) {
    throw new Error("Not enough inventory")
  }

  const existingItem = cart.items.find(
    (item) => item.product.id === input.productId
  )

  if (existingItem) {
    const newQuantity = existingItem.quantity + input.quantity
    if (product.manageInventory && newQuantity > product.inventoryQuantity) {
      throw new Error("Not enough inventory")
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    })
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: input.productId,
        quantity: input.quantity,
        unitPrice: product.unitPrice,
      },
    })
  }

  return getOrCreateCart(userId, sessionId)
}

export async function updateCartItem(itemId: string, quantity: number) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { product: true },
  })

  if (!item) throw new Error("Cart item not found")

  if (quantity < item.product.moq) {
    throw new Error(`Minimum order quantity is ${item.product.moq}`)
  }

  if (item.product.manageInventory && quantity > item.product.inventoryQuantity) {
    throw new Error("Not enough inventory")
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  })

  return getOrCreateCart(item.cart.userId || undefined, item.cart.sessionId || undefined)
}

export async function removeCartItem(itemId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true },
  })

  if (!item) throw new Error("Cart item not found")

  await prisma.cartItem.delete({ where: { id: itemId } })

  return getOrCreateCart(item.cart.userId || undefined, item.cart.sessionId || undefined)
}

export async function clearCart(userId?: string, sessionId?: string) {
  const cart = await getOrCreateCart(userId, sessionId)
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
  return getOrCreateCart(userId, sessionId)
}

export function calculateCartTotals(cart: CartWithItems) {
  const subtotal = cart.items.reduce((sum, item) => {
    return sum + Number(item.unitPrice) * item.quantity
  }, 0)

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    subtotal,
    itemCount,
    tax: 0,
    shipping: 0,
    total: subtotal,
  }
}
