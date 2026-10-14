import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';
import { RulesEngineService, CartItemContext } from '../rules/rules-engine.service';
import { SettingsService } from '../settings/settings.service';
import { LIVE_VARIANTS_WHERE, variantLabel } from '../products/variant-sync';

const CART_ITEMS_INCLUDE = {
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
        hasVariants: true,
        variantOptions: true,
        tierPrices: { select: { minQty: true, maxQty: true, price: true }, orderBy: { minQty: 'asc' as const } },
      },
    },
    variant: {
      select: { id: true, sku: true, options: true, price: true, image: true, inventoryQuantity: true, reservedQuantity: true, isActive: true },
    },
  },
};

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
    private rulesEnforcement: RulesEnforcementService,
    private rulesEngine: RulesEngineService,
    private settingsService: SettingsService,
  ) {}

  async getOrCreateCart(userId?: string, sessionId?: string) {
    let cart = null;

    if (userId) {
      cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: CART_ITEMS_INCLUDE,
        },
      });
    }

    if (!cart && sessionId) {
      cart = await this.prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: CART_ITEMS_INCLUDE,
        },
      });
    }

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: userId || null, sessionId: sessionId || null },
        include: {
          items: CART_ITEMS_INCLUDE,
        },
      });
    }

    if (userId && cart && cart.items.length > 0) await this.repriceItems(cart, userId);

    return this.decorateVariantItems(cart);
  }

  /**
   * Cart lines for a variant show the variant's details through the existing product fields, so the
   * cart page, mini cart and checkout need no changes: the title gets the variant label
   * ("Phone (Black / 128 GB)"), and SKU, image and stock are the variant's own.
   */
  private decorateVariantItems(cart: any) {
    for (const item of cart?.items || []) {
      const v = item.variant;
      if (!v || !item.product) continue;
      const label = variantLabel(v.options, item.product.variantOptions);
      item.variantLabel = label;
      item.product = {
        ...item.product,
        title: label ? `${item.product.title} (${label})` : item.product.title,
        sku: v.sku,
        thumbnail: v.image || item.product.thumbnail,
        inventoryQuantity: Math.max(0, v.inventoryQuantity - v.reservedQuantity),
        unitPrice: v.price,
        tierPrices: [],
      };
    }
    return cart;
  }

  /**
   * Resolves and checks the variant for a cart line. Products with variants can only be bought as a
   * specific, active variant; products without variants never take a variant id.
   */
  private async resolveVariant(product: any, variantId: string | undefined | null) {
    if (!product.hasVariants) {
      if (variantId) throw new BadRequestException('This product has no variants');
      return null;
    }
    if (!variantId) throw new BadRequestException('Please choose the product options before adding it to the cart');
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId: product.id, ...LIVE_VARIANTS_WHERE },
    });
    if (!variant || !variant.isActive) throw new BadRequestException('This option is not available');
    return variant;
  }

  /**
   * Cart lines remember the price they were added at. Contract, role or tier prices can change
   * afterwards (e.g. an admin assigns this buyer a contract price), so refresh each line to the
   * current effective price whenever the cart is loaded. Free (BOGO) and package lines are left alone.
   */
  private async repriceItems(cart: any, userId: string) {
    for (const item of cart.items as any[]) {
      const meta = (item.metadata || {}) as Record<string, any>;
      if (meta.bogo === true || meta.packageId || item.packageGroupId) continue;
      try {
        const pricing = await this.pricingService.calculateEffectivePrice(item.productId, item.quantity, userId, item.variantId || undefined);
        if (Number(item.unitPrice) !== Number(pricing.finalPrice)) {
          await this.prisma.cartItem.update({
            where: { id: item.id },
            data: { unitPrice: pricing.finalPrice, metadata: { ...meta, pricing } },
          });
          item.unitPrice = pricing.finalPrice;
          item.metadata = { ...meta, pricing };
        }
      } catch {
        /* leave the line as it was */
      }
    }
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
      // Units of the buy product across all its cart lines (one line per variant).
      const boughtQty = this.boughtQuantity(cartItems, bogo.buyProductId);
      if (boughtQty === 0) continue;

      const applicableFreeQty = Math.floor(boughtQty / bogo.buyQuantity) * (bogo.freeQuantity || 1);

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

        // A free product with variants is given as one of its variants (any variant qualifies).
        let freeVariantId: string | null = null;
        if (freeProduct.hasVariants && !existingBogoItem) {
          freeVariantId = await this.pickFreeVariant(cartId, freeProduct, addQty);
          if (!freeVariantId) continue; // no active variant has stock for the free units
        } else if (!freeProduct.hasVariants && freeProduct.manageInventory && !freeProduct.allowBackorder) {
          // A free unit is still stock that ships: only give it if it is available, on top of any
          // paid units of the same product in this cart.
          const paidUnits = (await this.prisma.cartItem.findMany({ where: { cartId, productId: freeProduct.id } }))
            .filter((l) => (l.metadata as any)?.bogo !== true)
            .reduce((sum, l) => sum + l.quantity, 0);
          const available = freeProduct.inventoryQuantity - freeProduct.reservedQuantity - paidUnits;
          if (available < applicableFreeQty) continue;
        }

        if (existingBogoItem) {
          // Update existing BOGO item quantity
          await this.prisma.cartItem.update({
            where: { id: existingBogoItem.id },
            data: {
              quantity: applicableFreeQty,
              metadata: { ...((existingBogoItem.metadata as any) || {}), buyQuantity: bogo.buyQuantity },
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
              variantId: freeVariantId,
              metadata: {
                bogo: true,
                bogoRuleName: bogo.ruleName,
                buyProductId: bogo.buyProductId,
                buyQuantity: bogo.buyQuantity,
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
   * Re-evaluates buy X get Y for a whole cart: adds earned free items and removes stale ones.
   * Returns true when the free items changed.
   */
  async syncFreeItems(cartId: string, userId?: string, userRole?: string): Promise<boolean> {
    const snapshot = async () =>
      (await this.prisma.cartItem.findMany({ where: { cartId, metadata: { path: ['bogo'], equals: true } }, orderBy: { id: 'asc' } }))
        .map((i) => `${i.id}:${i.productId}:${i.variantId}:${i.quantity}`)
        .join(',');
    const before = await snapshot();
    const items = await this.prisma.cartItem.findMany({ where: { cartId }, include: { product: { select: { categoryId: true } } } });
    const ctx: CartItemContext[] = items
      .filter((ci) => (ci.metadata as any)?.bogo !== true)
      .map((ci) => ({
        productId: ci.productId,
        categoryId: ci.product?.categoryId || undefined,
        quantity: ci.quantity,
        unitPrice: Number(ci.unitPrice),
        offerChoice: (ci.metadata as any)?.offerChoice || undefined,
      }));
    const subtotal = ctx.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    await this.applyBogoFreeItems(userId, userRole, ctx, subtotal, cartId);
    await this.cleanupStaleBogoItems(userId, userRole, ctx, subtotal, cartId);
    return (await snapshot()) !== before;
  }

  /** Units of a product in the cart, summed over all its (paid) lines — one line per variant. */
  private boughtQuantity(cartItems: CartItemContext[], productId: string) {
    return cartItems.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Chooses the variant given free. A variant the shopper is already buying comes first (most
   * units first), then the product's variants in display order; the first active one with enough
   * stock for the free units, on top of the units of it already in this cart, is used.
   */
  private async pickFreeVariant(cartId: string, product: { id: string; manageInventory: boolean; allowBackorder: boolean }, freeQty: number) {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId: product.id, isActive: true, ...LIVE_VARIANTS_WHERE },
      orderBy: { position: 'asc' },
    });
    if (variants.length === 0) return null;
    const lines = await this.prisma.cartItem.findMany({ where: { cartId, productId: product.id } });
    const paid = lines.filter((l) => (l.metadata as any)?.bogo !== true && l.variantId);
    const inCart = (variantId: string) => paid.filter((l) => l.variantId === variantId).reduce((sum, l) => sum + l.quantity, 0);
    const preferred = [...paid].sort((a, b) => b.quantity - a.quantity).map((l) => l.variantId as string);
    const ordered = [
      ...preferred.map((id) => variants.find((v) => v.id === id)).filter((v): v is (typeof variants)[number] => !!v),
      ...variants.filter((v) => !preferred.includes(v.id)),
    ];
    const hasStock = (v: (typeof variants)[number]) =>
      !product.manageInventory || product.allowBackorder || v.inventoryQuantity - v.reservedQuantity >= inCart(v.id) + freeQty;
    return ordered.find(hasStock)?.id ?? null;
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

    // Free units each offer currently earns, per (offer, free product).
    const allowance = new Map<string, number>();
    for (const bogo of result.bogo || []) {
      const boughtQty = this.boughtQuantity(cartItems, bogo.buyProductId);
      if (boughtQty === 0) continue;
      const key = `${bogo.ruleName}|${bogo.freeProductId}`;
      const qty = Math.floor(boughtQty / bogo.buyQuantity) * (bogo.freeQuantity || 1);
      allowance.set(key, Math.max(allowance.get(key) || 0, qty));
    }

    for (const bogoItem of bogoItems) {
      const key = `${(bogoItem.metadata as any)?.bogoRuleName}|${bogoItem.productId}`;
      const left = allowance.get(key) || 0;
      if (left <= 0) {
        // The offer no longer applies (condition not met, offer switched or removed): drop the free item.
        await this.prisma.cartItem.delete({ where: { id: bogoItem.id } });
      } else {
        if (bogoItem.quantity > left) {
          await this.prisma.cartItem.update({ where: { id: bogoItem.id }, data: { quantity: left } });
        }
        allowance.set(key, Math.max(0, left - bogoItem.quantity));
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
    offerChoice?: string,
    variantId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new BadRequestException('Product not found');
    if (product.status !== 'PUBLISHED')
      throw new BadRequestException('Product is not available');
    const variant = await this.resolveVariant(product, variantId);
    // Skip MOQ check for package component items — the package determines the purchase quantity
    if (!packageGroupId && quantity < product.moq)
      throw new BadRequestException(`Minimum order quantity is ${product.moq}`);
    const stockOf = () =>
      variant ? variant.inventoryQuantity - variant.reservedQuantity : product.inventoryQuantity - product.reservedQuantity;
    const availableStock = stockOf();
    if (product.manageInventory && quantity > availableStock)
      throw new BadRequestException(variant && availableStock <= 0 ? 'This option is out of stock' : 'Not enough inventory');

    // Evaluate dynamic rules — block non-purchasable products and max quantity violations
    // Build the prospective cart items context including the new item
    const existingItem = cart.items.find(
      (item) =>
        item.productId === productId &&
        ((item as any).variantId || null) === (variant?.id || null) &&
        (item as any).packageGroupId === (packageGroupId || null) &&
        (item.metadata as any)?.bogo !== true,
    );

    const prospectiveCartItems: CartItemContext[] = cart.items.filter(((x: any) => (x.metadata as any)?.bogo !== true)).map((item) => ({
      productId: item.productId,
      categoryId: (item as any).product?.categoryId || undefined,
      quantity: existingItem && item.id === existingItem.id ? existingItem.quantity + quantity : item.quantity,
      unitPrice: Number(item.unitPrice),
      offerChoice: (item.metadata as any)?.offerChoice || undefined,
    }));

    // Add the new item if not already in cart
    if (!existingItem) {
      prospectiveCartItems.push({
        productId,
        categoryId: product.categoryId || undefined,
        quantity,
        unitPrice: Number(variant ? variant.price : product.unitPrice),
        offerChoice,
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
      variant?.id,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const availableStock2 = stockOf();
      if (product.manageInventory && newQuantity > availableStock2)
        throw new BadRequestException('Not enough inventory');

      // Recalculate price for new quantity
      const newPricing = await this.pricingService.calculateEffectivePrice(
        productId,
        newQuantity,
        userId,
        variant?.id,
      );

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          unitPrice: newPricing.finalPrice,
          metadata: { pricing: newPricing, ...(offerChoice || (existingItem.metadata as any)?.offerChoice ? { offerChoice: offerChoice || (existingItem.metadata as any)?.offerChoice } : {}) },
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          unitPrice: pricing.finalPrice,
          metadata: packageMetadata || { pricing, ...(offerChoice ? { offerChoice } : {}) },
          packageGroupId: packageGroupId || null,
          variantId: variant?.id || null,
        },
      });
    }

    // Auto-add earned free items, and drop free items that no longer apply: adding can change which
    // offer wins (e.g. reaching "buy 10 get 5" replaces "buy 3 get 1"), and an offer may have ended.
    await this.applyBogoFreeItems(userId, userRole, prospectiveCartItems, subtotal, cart.id);
    await this.cleanupStaleBogoItems(userId, userRole, prospectiveCartItems, subtotal, cart.id);

    return this.getOrCreateCart(userId, sessionId);
  }

  async updateItem(itemId: string, quantity: number, userId?: string, userRole?: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true, cart: true, variant: true },
    });

    if (!item) throw new BadRequestException('Cart item not found');
    if ((item.metadata as any)?.bogo === true)
      throw new BadRequestException('Free items follow the offer and cannot be edited');
    if (quantity < item.product.moq)
      throw new BadRequestException(
        `Minimum order quantity is ${item.product.moq}`,
      );
    const availableStock3 = item.variant
      ? item.variant.inventoryQuantity - item.variant.reservedQuantity
      : item.product.inventoryQuantity - item.product.reservedQuantity;
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
        const cartItemsContext: CartItemContext[] = cart.items.filter(((x: any) => (x.metadata as any)?.bogo !== true)).map((ci) => ({
          productId: ci.productId,
          categoryId: (ci as any).product?.categoryId || undefined,
          quantity: ci.id === itemId ? quantity : ci.quantity,
          unitPrice: Number(ci.unitPrice),
          offerChoice: (ci.metadata as any)?.offerChoice || undefined,
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
        // Lowering the quantity can drop below the offer's buy quantity — remove (or trim)
        // free items that no longer qualify, otherwise they would stay in the cart.
        await this.cleanupStaleBogoItems(cartUserId, userRole, cartItemsContext, subtotal, cart.id);
      }
    }

    const pricing = await this.pricingService.calculateEffectivePrice(
      item.productId,
      quantity,
      cartUserId,
      item.variantId || undefined,
    );

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        unitPrice: pricing.finalPrice,
        metadata: { pricing, ...((item.metadata as any)?.offerChoice ? { offerChoice: (item.metadata as any).offerChoice } : {}) },
      },
    });

    return this.getOrCreateCart(
      item.cart.userId || undefined,
      item.cart.sessionId || undefined,
    );
  }

  /**
   * Remember which offer the shopper picked for a product (a rule id, or "none"), then
   * re-sync BOGO free items so only the chosen offer's free goods stay in the cart.
   */
  async setOfferChoice(productId: string, choice: string, userId?: string, sessionId?: string, userRole?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const items = await this.prisma.cartItem.findMany({ where: { cartId: cart.id, productId } });
    const buyItems = items.filter((i) => (i.metadata as any)?.bogo !== true);
    if (buyItems.length === 0) return cart;

    for (const it of buyItems) {
      const meta = ((it.metadata as any) || {}) as Record<string, any>;
      await this.prisma.cartItem.update({
        where: { id: it.id },
        data: { metadata: { ...meta, offerChoice: choice } },
      });
    }

    const fresh = await this.prisma.cartItem.findMany({ where: { cartId: cart.id }, include: { product: { select: { categoryId: true } } } });
    const ctx: CartItemContext[] = fresh.filter(((x: any) => (x.metadata as any)?.bogo !== true)).map((ci: any) => ({
      productId: ci.productId,
      categoryId: ci.product?.categoryId || undefined,
      quantity: ci.quantity,
      unitPrice: Number(ci.unitPrice),
      offerChoice: (ci.metadata as any)?.offerChoice || undefined,
    }));
    const subtotal = ctx.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    await this.applyBogoFreeItems(userId, userRole, ctx, subtotal, cart.id);
    await this.cleanupStaleBogoItems(userId, userRole, ctx, subtotal, cart.id);
    return this.getOrCreateCart(userId, sessionId);
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
        .filter(((x: any) => (x.metadata as any)?.bogo !== true)) // free goods never count towards an offer's buy quantity
        .map((ci) => ({
          productId: ci.productId,
          categoryId: (ci as any).product?.categoryId || undefined,
          quantity: ci.quantity,
          unitPrice: Number(ci.unitPrice),
          offerChoice: (ci.metadata as any)?.offerChoice || undefined,
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
      // Free lines are never carried over; they are recomputed for the merged cart below.
      if ((guestItem.metadata as any)?.bogo === true) continue;
      const guestPackageGroupId = (guestItem as any).packageGroupId || null;
      const existingItem = userCart.items.find(
        (i) =>
          (i.metadata as any)?.bogo !== true &&
          i.productId === guestItem.productId &&
          (i.variantId || null) === (guestItem.variantId || null) &&
          (i as any).packageGroupId === guestPackageGroupId,
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
            variantId: guestItem.variantId || null,
            metadata: guestItem.metadata,
          },
        });
      }
    }

    // Delete guest cart after merge
    await this.prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => null);

    // Guests get no free items; now that the cart belongs to a signed-in buyer, give the free
    // items its (merged) quantities earn.
    await this.syncFreeItems(userCart.id, userId);

    return this.getOrCreateCart(userId, undefined);
  }

  /**
   * Computes cart totals (tax, shipping, coupon discount, grand total) using the same
   * RulesEngineService (admin Tax/Shipping DynamicRules) and round-off setting that
   * orders.service.ts::computeAmountBreakdown uses to charge the order, so the total
   * shown in the cart matches the Pay Now total instead of only appearing at checkout.
   */
  async calculateTotals(
    cart: any,
    couponCode?: string,
    userId?: string,
    userRole?: string,
    shippingRegion?: string,
  ) {
    const subtotal = cart.items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const itemCount = cart.items.reduce(
      (sum: number, item: any) => sum + (item.metadata?.bogo === true ? 0 : item.quantity),
      0,
    );

    const cartItems: CartItemContext[] = cart.items.filter(((x: any) => (x.metadata as any)?.bogo !== true)).map((item: any) => ({
      productId: item.productId,
      categoryId: item.product?.categoryId || undefined,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      offerChoice: (item.metadata as any)?.offerChoice || undefined,
    }));

    const settings = await this.settingsService.findAll();

    const ruleResult = await this.rulesEngine.evaluateRules({
      userId,
      userRole,
      cartItems,
      subtotal,
      shippingRegion,
      sellerState: settings.businessState || undefined,
    });

    // Split into CGST/SGST/IGST per matched rule (see RulesEngineService.evaluateTaxRule) —
    // cgst+sgst+igst always equals the same total the old flat `taxRate`-based sum produced,
    // GST is never charged twice.
    const cgstAmount = ruleResult.taxes.reduce((sum, t) => sum + (subtotal * t.cgstRate) / 100, 0);
    const sgstAmount = ruleResult.taxes.reduce((sum, t) => sum + (subtotal * t.sgstRate) / 100, 0);
    const igstAmount = ruleResult.taxes.reduce((sum, t) => sum + (subtotal * t.igstRate) / 100, 0);
    const tax = cgstAmount + sgstAmount + igstAmount;
    const shipping = ruleResult.shipping?.cost ?? 0;

    let couponDiscount = 0;
    let couponApplied: string | null = null;
    if (couponCode) {
      const couponResult = await this.pricingService.applyCoupon(couponCode, subtotal);
      if (couponResult.valid) {
        couponDiscount = couponResult.discountAmount;
        couponApplied = couponCode.toUpperCase();
      }
    }

    const roundOffEnabled = settings.roundOffEnabled === 'true';
    const rawTotal = Math.max(0, subtotal - couponDiscount) + tax + shipping;
    const total = roundOffEnabled ? Math.round(rawTotal) : rawTotal;

    return {
      subtotal,
      itemCount,
      tax,
      cgstAmount,
      sgstAmount,
      igstAmount,
      shipping,
      couponDiscount,
      couponApplied,
      total,
      taxes: ruleResult.taxes,
      shippingRule: ruleResult.shipping,
    };
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