import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';
import { RulesEngineService, CartItemContext } from '../rules/rules-engine.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
    private rulesEnforcement: RulesEnforcementService,
    private rulesEngine: RulesEngineService,
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
                  categoryId: true,
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
                  categoryId: true,
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
                  categoryId: true,
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

  /**
   * After a cart change (add/update), evaluate BOGO rules and auto-add
   * free items to the cart. Only runs for authenticated users.
   * Free items are added at price 0 with metadata marking them as BOGO.
   */
  private async applyBogoFreeItems(
    userId: string | undefined,
    userRole: string | undefined,
    cartItems: CartItemContext[],
    subtotal: number,
    cartId: string,
  ) {
    if (!userId) return; // BOGO only for authenticated users

    const result = await this.rulesEngine.evaluateRules({
      userId,
      userRole,
      cartItems,
      subtotal,
    });

    if (!result.bogo || result.bogo.length === 0) return;

    // Get current cart items to check what's already there
    const currentItems = await this.prisma.cartItem.findMany({
      where: { cartId },
    });

    for (const bogo of result.bogo) {
      // Check how many times this BOGO rule applies
      // (e.g., if buyQuantity is 3 and user has 6, they get 2 free)
      const buyItem = cartItems.find((item) => item.productId === bogo.buyProductId);
      if (!buyItem) continue;

      const applicableFreeQty = Math.floor(buyItem.quantity / bogo.buyQuantity) * (bogo.freeQuantity || 1);

      // Check how many of this free product are already in the cart as BOGO items
      const existingBogoItem = currentItems.find(
        (item) =>
          item.productId === bogo.freeProductId &&
          (item.metadata as any)?.bogo === true &&
          (item.metadata as any)?.bogoRuleName === bogo.ruleName,
      );

      const existingBogoQty = existingBogoItem ? existingBogoItem.quantity : 0;

      if (applicableFreeQty > existingBogoQty) {
        // Need to add or update the BOGO free item
        const freeProduct = await this.prisma.product.findUnique({
          where: { id: bogo.freeProductId },
        });

        if (!freeProduct || freeProduct.status !== 'PUBLISHED') continue;

        const addQty = applicableFreeQty - existingBogoQty;

        if (existingBogoItem) {
          // Update existing BOGO item quantity
          await this.prisma.cartItem.update({
            where: { id: existingBogoItem.id },
            data: {
              quantity: applicableFreeQty,
            },
          });
        } else {
          // Create new BOGO free item with price 0
          await this.prisma.cartItem.create({
            data: {
              cartId,
              productId: bogo.freeProductId,
              quantity: addQty,
              unitPrice: 0,
              metadata: {
                bogo: true,
                bogoRuleName: bogo.ruleName,
                buyProductId: bogo.buyProductId,
                freeProductId: bogo.freeProductId,
                freeQuantity: bogo.freeQuantity || 1,
              },
            },
          });
        }
      } else if (applicableFreeQty < existingBogoQty && applicableFreeQty > 0) {
        // Reduce BOGO free item quantity
        if (existingBogoItem) {
          await this.prisma.cartItem.update({
            where: { id: existingBogoItem.id },
            data: { quantity: applicableFreeQty },
          });
        }
      } else if (applicableFreeQty === 0 && existingBogoItem) {
        // BOGO no longer applies — remove the free item
        await this.prisma.cartItem.delete({
          where: { id: existingBogoItem.id },
        });
      }
    }
  }

  /**
   * Remove BOGO free items that are no longer valid after an item is removed
   * or its quantity is reduced. This re-evaluates and cleans up stale BOGO items.
   */
  private async cleanupStaleBogoItems(
    userId: string | undefined,
    userRole: string | undefined,
    cartItems: CartItemContext[],
    subtotal: number,
    cartId: string,
  ) {
    if (!userId) {
      // For guest carts, remove all BOGO items since we can't evaluate rules
      await this.prisma.cartItem.deleteMany({
        where: { cartId, metadata: { path: ['bogo'], equals: true } },
      }).catch(() => null);
      return;
    }

    const result = await this.rulesEngine.evaluateRules({
      userId,
      userRole,
      cartItems,
      subtotal,
    });

    // Get all current BOGO items in the cart
    const currentItems = await this.prisma.cartItem.findMany({
      where: { cartId },
    });

    const bogoItems = currentItems.filter(
      (item) => (item.metadata as any)?.bogo === true,
    );

    // Build a set of valid BOGO free product IDs from current evaluation
    const validBogoFreeProducts = new Map<string, { qty: number; ruleName: string }>();
    if (result.bogo) {
      for (const bogo of result.bogo) {
        const buyItem = cartItems.find((item) => item.productId === bogo.buyProductId);
        if (!buyItem) continue;
        const applicableFreeQty = Math.floor(buyItem.quantity / bogo.buyQuantity) * (bogo.freeQuantity || 1);
        const existing = validBogoFreeProducts.get(bogo.freeProductId);
        if (!existing || applicableFreeQty > existing.qty) {
          validBogoFreeProducts.set(bogo.freeProductId, { qty: applicableFreeQty, ruleName: bogo.ruleName });
        }
      }
    }

    for (const bogoItem of bogoItems) {
      const metadata = bogoItem.metadata as any;
      const freeProductId = bogoItem.productId;
      const ruleName = metadata?.bogoRuleName;

      const valid = validBogoFreeProducts.get(freeProductId);
      if (!valid || valid.ruleName !== ruleName) {
        // This BOGO item is no longer valid — remove it
        await this.prisma.cartItem.delete({ where: { id: bogoItem.id } });
      } else if (valid.qty < bogoItem.quantity) {
        // Reduce quantity
        await this.prisma.cartItem.update({
          where: { id: bogoItem.id },
          data: { quantity: valid.qty },
        });
      }
    }
  }

  async addItem(
    productId: string,
    quantity: number,
    userId?: string,
    sessionId?: string,
    packageGroupId?: string,
    packageMetadata?: any,
    userRole?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new BadRequestException('Product not found');
    if (product.status !== 'PUBLISHED')
      throw new BadRequestException('Product is not available');
    // Skip MOQ check for package component items — the package determines the purchase quantity
    if (!packageGroupId && quantity < product.moq)
      throw new BadRequestException(`Minimum order quantity is ${product.moq}`);
    const availableStock = product.inventoryQuantity - product.reservedQuantity;
    if (product.manageInventory && quantity > availableStock)
      throw new BadRequestException('Not enough inventory');

    // Evaluate dynamic rules — block non-purchasable products and max quantity violations
    // Build the prospective cart items context including the new item
    const existingItem = cart.items.find(
      (item) => item.productId === productId && (item as any).packageGroupId === (packageGroupId || null),
    );

    const prospectiveCartItems: CartItemContext[] = cart.items.map((item) => ({
      productId: item.productId,
      categoryId: (item as any).product?.categoryId || undefined,
      quantity: item.productId === productId
        ? (existingItem ? existingItem.quantity + quantity : quantity)
        : item.quantity,
      unitPrice: Number(item.unitPrice),
    }));

    // Add the new item if not already in cart
    if (!existingItem) {
      prospectiveCartItems.push({
        productId,
        categoryId: product.categoryId || undefined,
        quantity,
        unitPrice: Number(product.unitPrice),
      });
    }

    const subtotal = prospectiveCartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

    // Only enforce rules for authenticated users (guests have no role context)
    if (userId) {
      await this.rulesEnforcement.enforceCartRules({
        userId,
        userRole,
        cartItems: prospectiveCartItems,
        subtotal,
      });
    }

    // Calculate effective price with discounts
    const pricing = await this.pricingService.calculateEffectivePrice(
      productId,
      quantity,
      userId,
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
          metadata: packageMetadata || { pricing },
          packageGroupId: packageGroupId || null,
        },
      });
    }

    // Auto-add BOGO free items
    await this.applyBogoFreeItems(userId, userRole, prospectiveCartItems, subtotal, cart.id);

    return this.getOrCreateCart(userId, sessionId);
  }

  async updateItem(itemId: string, quantity: number, userId?: string, userRole?: string) {
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

    // Evaluate dynamic rules for max quantity enforcement
    const cartUserId = item.cart.userId || undefined;
    if (cartUserId) {
      // Build cart items context with the updated quantity
      const cart = await this.prisma.cart.findUnique({
        where: { id: item.cartId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, categoryId: true, unitPrice: true },
              },
            },
          },
        },
      });

      if (cart) {
        const cartItemsContext: CartItemContext[] = cart.items.map((ci) => ({
          productId: ci.productId,
          categoryId: (ci as any).product?.categoryId || undefined,
          quantity: ci.id === itemId ? quantity : ci.quantity,
          unitPrice: Number(ci.unitPrice),
        }));

        const subtotal = cartItemsContext.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

        await this.rulesEnforcement.enforceCartRules({
          userId: cartUserId,
          userRole,
          cartItems: cartItemsContext,
          subtotal,
        });

        // Update BOGO free items after quantity change
        await this.applyBogoFreeItems(cartUserId, userRole, cartItemsContext, subtotal, cart.id);
      }
    }

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

    // Clean up stale BOGO items after removal
    const cartUserId = item.cart.userId || undefined;
    const cart = await this.prisma.cart.findUnique({
      where: { id: item.cartId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, categoryId: true, unitPrice: true },
            },
          },
        },
      },
    });

    if (cart) {
      const cartItemsContext: CartItemContext[] = cart.items
        .filter((ci) => ci.id !== item.id) // exclude the removed item
        .map((ci) => ({
          productId: ci.productId,
          categoryId: (ci as any).product?.categoryId || undefined,
          quantity: ci.quantity,
          unitPrice: Number(ci.unitPrice),
        }));
      const subtotal = cartItemsContext.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      await this.cleanupStaleBogoItems(cartUserId, undefined, cartItemsContext, subtotal, cart.id);
    }

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
      const guestPackageGroupId = (guestItem as any).packageGroupId || null;
      const existingItem = userCart.items.find(
        (i) => i.productId === guestItem.productId && (i as any).packageGroupId === guestPackageGroupId,
      );
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
            packageGroupId: guestPackageGroupId,
            metadata: guestItem.metadata,
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