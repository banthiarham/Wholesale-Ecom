import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateCart(userId?: string, sessionId?: string) {
    let cart = null;

    if (userId) {
      cart = await this.prisma.cart.findUnique({
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
      });
    }

    if (!cart && sessionId) {
      cart = await this.prisma.cart.findUnique({
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
      });
    }

    if (!cart) {
      cart = await this.prisma.cart.create({
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
      });
    }

    return cart;
  }

  async addItem(
    productId: string,
    quantity: number,
    userId?: string,
    sessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new BadRequestException('Product not found');
    if (product.status !== 'PUBLISHED')
      throw new BadRequestException('Product is not available');
    if (quantity < product.moq)
      throw new BadRequestException(`Minimum order quantity is ${product.moq}`);
    if (product.manageInventory && quantity > product.inventoryQuantity)
      throw new BadRequestException('Not enough inventory');

    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.manageInventory && newQuantity > product.inventoryQuantity)
        throw new BadRequestException('Not enough inventory');

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          unitPrice: product.unitPrice,
        },
      });
    }

    return this.getOrCreateCart(userId, sessionId);
  }

  async updateItem(itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true, cart: true },
    });

    if (!item) throw new BadRequestException('Cart item not found');
    if (quantity < item.product.moq)
      throw new BadRequestException(
        `Minimum order quantity is ${item.product.moq}`,
      );
    if (item.product.manageInventory && quantity > item.product.inventoryQuantity)
      throw new BadRequestException('Not enough inventory');

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    return this.getOrCreateCart(
      item.cart.userId || undefined,
      item.cart.sessionId || undefined,
    );
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item) throw new BadRequestException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    return this.getOrCreateCart(
      item.cart.userId || undefined,
      item.cart.sessionId || undefined,
    );
  }

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getOrCreateCart(userId, sessionId);
  }

  calculateTotals(cart: any) {
    const subtotal = cart.items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const itemCount = cart.items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );
    return { subtotal, itemCount, tax: 0, shipping: 0, total: subtotal };
  }
}
