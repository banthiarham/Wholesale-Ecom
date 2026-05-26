import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
  ) {}

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
                  compareAtPrice: true,
                  tierPrices: { select: { minQty: true, maxQty: true, price: true }, orderBy: { minQty: 'asc' } },
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
                  compareAtPrice: true,
                  tierPrices: { select: { minQty: true, maxQty: true, price: true }, orderBy: { minQty: 'asc' } },
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
                  compareAtPrice: true,
                  tierPrices: { select: { minQty: true, maxQty: true, price: true }, orderBy: { minQty: 'asc' } },
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
    const availableStock = product.inventoryQuantity - product.reservedQuantity;
    if (product.manageInventory && quantity > availableStock)
      throw new BadRequestException('Not enough inventory');

    // Calculate effective price with discounts
    const pricing = await this.pricingService.calculateEffectivePrice(
      productId,
      quantity,
      userId,
    );

    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const availableStock2 = product.inventoryQuantity - product.reservedQuantity;
      if (product.manageInventory && newQuantity > availableStock2)
        throw new BadRequestException('Not enough inventory');

      // Recalculate price for new quantity
      const newPricing = await this.pricingService.calculateEffectivePrice(
        productId,
        newQuantity,
        userId,
      );

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          unitPrice: newPricing.finalPrice,
          metadata: { pricing: newPricing },
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          unitPrice: pricing.finalPrice,
          metadata: { pricing },
        },
      });
    }

    return this.getOrCreateCart(userId, sessionId);
  }

  async updateItem(itemId: string, quantity: number, userId?: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true, cart: true },
    });

    if (!item) throw new BadRequestException('Cart item not found');
    if (quantity < item.product.moq)
      throw new BadRequestException(
        `Minimum order quantity is ${item.product.moq}`,
      );
    const availableStock3 = item.product.inventoryQuantity - item.product.reservedQuantity;
    if (item.product.manageInventory && quantity > availableStock3)
      throw new BadRequestException('Not enough inventory');

    const cartUserId = item.cart.userId || undefined;
    const pricing = await this.pricingService.calculateEffectivePrice(
      item.productId,
      quantity,
      cartUserId,
    );

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        unitPrice: pricing.finalPrice,
        metadata: { pricing },
      },
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

  async mergeGuestCart(sessionId: string, userId: string) {
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      return this.getOrCreateCart(userId, undefined);
    }

    let userCart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!userCart) {
      userCart = await this.prisma.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    for (const guestItem of guestCart.items) {
      const existingItem = userCart.items.find((i) => i.productId === guestItem.productId);
      if (existingItem) {
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + guestItem.quantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: guestItem.productId,
            quantity: guestItem.quantity,
            unitPrice: guestItem.unitPrice,
          },
        });
      }
    }

    // Delete guest cart after merge
    await this.prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => null);

    return this.getOrCreateCart(userId, undefined);
  }

  calculateTotals(cart: any, couponCode?: string) {
    const subtotal = cart.items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const itemCount = cart.items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );
    const tax = subtotal * 0.18; // 18% GST
    const shipping = subtotal > 50000 ? 0 : 500; // Free shipping above 50k
    let couponDiscount = 0;
    let couponApplied = null;

    return { subtotal, itemCount, tax, shipping, couponDiscount, couponApplied, total: subtotal + tax + shipping - couponDiscount };
  }

  async validateCoupon(cart: any, couponCode: string) {
    const subtotal = cart.items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    return this.pricingService.applyCoupon(couponCode, subtotal);
  }
}
