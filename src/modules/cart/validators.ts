import { z } from "zod"

export const addToCartSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
})

export const updateCartItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
})

export const removeFromCartSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
})

export const getCartSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
})
