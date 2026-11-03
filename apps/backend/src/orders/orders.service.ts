import { syncPaymentWithOrderStatus } from './payment-sync';
import { PricingService } from '../pricing/pricing.service';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { variantLabel, LIVE_VARIANTS_WHERE } from '../products/variant-sync';
import { AdminCreateOrderDto, AdminUpdateOrderDto, AdminOrderItemDto } from './dto/admin-order.dto';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyEarningService } from '../loyalty/loyalty-earning.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';
import { CartItemContext, RuleEvaluationResult } from '../rules/rules-engine.service';
import { SettingsService } from '../settings/settings.service';
import { OrderStatus, PaymentStatus, DeliveryStatus, RefundStatus } from '@prisma/client';

const ORDER_STATUS_MESSAGES: Partial<Record<OrderStatus, { title: string; message: (orderNumber: string) => string }>> = {
  CONFIRMED: { title: 'Order confirmed', message: (n) => `Your order #${n} has been confirmed and is being prepared.` },
  PROCESSING: { title: 'Order packed', message: (n) => `Your order #${n} has been packed and is ready to ship.` },
  SHIPPED: { title: 'Order shipped', message: (n) => `Your order #${n} is on its way.` },
  DELIVERED: { title: 'Order delivered', message: (n) => `Your order #${n} has been delivered. We hope you enjoy it!` },
  CANCELLED: { title: 'Order cancelled', message: (n) => `Your order #${n} has been cancelled.` },
  REFUNDED: { title: 'Order refunded', message: (n) => `Your order #${n} has been refunded.` },
};

const DELIVERY_STATUS_MESSAGES: Partial<Record<DeliveryStatus, { title: string; message: (orderNumber: string) => string }>> = {
  PICKED_UP: { title: 'Order picked up', message: (n) => `Your order #${n} has been picked up by the courier.` },
  IN_TRANSIT: { title: 'Order in transit', message: (n) => `Your order #${n} is in transit.` },
  OUT_FOR_DELIVERY: { title: 'Out for delivery', message: (n) => `Your order #${n} is out for delivery today.` },
  FAILED: { title: 'Delivery attempt failed', message: (n) => `A delivery attempt for your order #${n} was unsuccessful. We'll retry soon.` },
  RETURNED: { title: 'Order returned', message: (n) => `Your order #${n} has been marked as returned.` },
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private loyaltyEarningService: LoyaltyEarningService,
    private rulesEnforcement: RulesEnforcementService,
    private settingsService: SettingsService,
    private pricingService: PricingService,
  ) {}

  /**
   * Turns a rule-engine evaluation + pre-computed discounts into the persisted amount
   * breakdown. `subtotal` must be the raw pre-discount item sum (matches the checkout
   * page's own `ruleTaxTotal`/`finalTotal` math so what buyers see pre-payment is what
   * gets charged). Rule-based product/cart/quantity discounts, extra charges, and
   * wallet/loyalty redemption are intentionally NOT folded in here — they stay
   * checkout-preview-only, unchanged from current behavior.
   */
  private async computeAmountBreakdown(subtotal: number, discountAmount: number, ruleResult: RuleEvaluationResult) {
    // Split into CGST/SGST/IGST per matched rule (see RulesEngineService.evaluateTaxRule) —
    // cgst+sgst+igst always equals the same total the old flat `taxRate`-based sum produced,
    // GST is never charged twice on top of its own components.
    const cgstAmount = ruleResult.taxes.reduce((sum, tax) => sum + (subtotal * tax.cgstRate) / 100, 0);
    const sgstAmount = ruleResult.taxes.reduce((sum, tax) => sum + (subtotal * tax.sgstRate) / 100, 0);
    const igstAmount = ruleResult.taxes.reduce((sum, tax) => sum + (subtotal * tax.igstRate) / 100, 0);
    const taxAmount = cgstAmount + sgstAmount + igstAmount;
    const shippingAmount = ruleResult.shipping?.cost ?? 0;

    const rawTotal = Math.max(0, subtotal - discountAmount) + taxAmount + shippingAmount;

    const settings = await this.settingsService.findAll();
    const roundOffEnabled = settings.roundOffEnabled === 'true';
    const roundedTotal = roundOffEnabled ? Math.round(rawTotal) : rawTotal;
    const roundOffAmount = roundedTotal - rawTotal;

    return {
      subtotal,
      taxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      shippingAmount,
      discountAmount,
      roundOffAmount,
      totalAmount: roundedTotal,
    };
  }

  /** The business's own GST-registered state, used to determine CGST+SGST vs IGST. */
  private async getSellerState(): Promise<string | undefined> {
    const settings = await this.settingsService.findAll();
    return settings.businessState || undefined;
  }

  private async notifyOrderStatus(userId: string, orderId: string, orderNumber: string, status: OrderStatus) {
    const copy = ORDER_STATUS_MESSAGES[status];
    if (!copy) return;
    try {
      await this.notificationsService.createNotification(
        userId,
        'ORDER',
        copy.title,
        copy.message(orderNumber.slice(0, 8)),
        { orderId, status },
      );
    } catch (err) {
      this.logger.error(`Failed to send order status notification for ${orderId}: ${err.message}`);
    }
  }

  private async notifyDeliveryStatus(userId: string, orderId: string, orderNumber: string, status: DeliveryStatus) {
    const copy = DELIVERY_STATUS_MESSAGES[status];
    if (!copy) return;
    try {
      await this.notificationsService.createNotification(
        userId,
        'ORDER',
        copy.title,
        copy.message(orderNumber.slice(0, 8)),
        { orderId, deliveryStatus: status },
      );
    } catch (err) {
      this.logger.error(`Failed to send delivery status notification for ${orderId}: ${err.message}`);
    }
  }

  async createFromCart(userId: string, cartId: string, data: { shippingAddress: any; billingAddress?: any; notes?: string; couponCode?: string; bankOfferId?: string; paymentMethod?: string }) {
    // Offline payment methods can be switched off by the admin (Payment Gateways); refuse orders that still try to use one.
    if (data.paymentMethod === 'UPI' && !(await this.prisma.paymentGateway.findFirst({ where: { provider: 'UPI', isActive: true } }))) {
      throw new BadRequestException('UPI is currently unavailable. Please choose another payment method.');
    }
    if (data.paymentMethod === 'COD' || data.paymentMethod === 'BANK_TRANSFER') {
      // COD is on unless an admin turned it off; Bank Transfer needs at least one active bank account.
      const unavailable = data.paymentMethod === 'COD'
        ? !!(await this.prisma.paymentGateway.findFirst({ where: { provider: 'COD' } })) && !(await this.prisma.paymentGateway.findFirst({ where: { provider: 'COD', isActive: true } }))
        : !(await this.prisma.paymentGateway.findFirst({ where: { provider: 'BANK_TRANSFER', isActive: true } }));
      if (unavailable) {
        throw new BadRequestException(data.paymentMethod === 'COD' ? 'Cash on Delivery is currently unavailable. Please choose another payment method.' : 'Bank transfer is currently unavailable. Please choose another payment method.');
      }
    }

    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true, variant: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    let totalAmount = 0;
    const orderItemsData = cart.items.map((item) => {
      const totalPrice = Number(item.unitPrice) * item.quantity;
      totalAmount += totalPrice;
      const variant = (item as any).variant;
      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: totalPrice,
        // Preserve package composition and pricing data; for a variant also keep what was bought
        // (label, SKU, options) so the order reads correctly even if the variant changes later.
        metadata: variant
          ? {
              ...((item.metadata as any) || {}),
              variant: {
                id: variant.id,
                sku: variant.sku,
                options: variant.options,
                label: variantLabel(variant.options as any, (item.product as any).variantOptions as any),
              },
            }
          : (item.metadata as any),
      };
    });
    const subtotal = totalAmount;

    // Enforce dynamic rules before creating the order
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const cartItemsContext: CartItemContext[] = cart.items.filter((item: any) => item.metadata?.bogo !== true).map((item) => ({
      productId: item.productId,
      categoryId: item.product?.categoryId || undefined,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      offerChoice: ((item as any).metadata as any)?.offerChoice || undefined,
    }));

    const ruleResult = await this.rulesEnforcement.enforceOrderRules({
      userId,
      userRole: (user as any)?.effectiveRole || (user as any)?.roleRel?.name || user?.role || undefined,
      cartItems: cartItemsContext,
      subtotal: totalAmount,
      shippingRegion: data.shippingAddress?.state || undefined,
      sellerState: await this.getSellerState(),
    });

    // Free (buy X get Y) lines are only ordered as far as the offer still allows right now: an
    // offer that expired, was switched off, or whose buy quantity is no longer met since the cart
    // was last updated must not ship free goods.
    const freeAllowance = new Map<string, number>();
    for (const b of ruleResult.bogo || []) {
      const bought = cartItemsContext.filter((i) => i.productId === b.buyProductId).reduce((sum, i) => sum + i.quantity, 0);
      const key = `${b.ruleName}|${b.freeProductId}`;
      freeAllowance.set(key, Math.max(freeAllowance.get(key) || 0, Math.floor(bought / b.buyQuantity) * (b.freeQuantity || 1)));
    }
    for (let i = orderItemsData.length - 1; i >= 0; i--) {
      const meta = (orderItemsData[i].metadata || {}) as any;
      if (meta.bogo !== true) continue;
      const key = `${meta.bogoRuleName}|${orderItemsData[i].productId}`;
      const left = freeAllowance.get(key) || 0;
      const qty = Math.min(orderItemsData[i].quantity, left);
      freeAllowance.set(key, left - qty);
      if (qty <= 0) orderItemsData.splice(i, 1);
      else orderItemsData[i] = { ...orderItemsData[i], quantity: qty, totalPrice: Number(orderItemsData[i].unitPrice) * qty };
    }

    // Apply coupon discount if provided
    let couponDiscount = 0;
    let appliedCoupon: any = null;
    if (data.couponCode) {
      const coupon = await this.prisma.coupon.findFirst({
        where: { code: data.couponCode.toUpperCase(), isActive: true },
      });
      if (coupon) {
        const now = new Date();
        const isValid =
          (!coupon.startDate || new Date(coupon.startDate) <= now) &&
          (!coupon.endDate || new Date(coupon.endDate) >= now) &&
          (!coupon.maxUses || coupon.usedCount < coupon.maxUses) &&
          (!coupon.minOrderValue || totalAmount >= Number(coupon.minOrderValue));

        if (isValid) {
          if (coupon.type === 'PERCENTAGE') {
            couponDiscount = totalAmount * (Number(coupon.value) / 100);
          } else {
            couponDiscount = Number(coupon.value);
          }
          couponDiscount = Math.min(couponDiscount, totalAmount);
          appliedCoupon = coupon;
        }
      }
    }

    totalAmount = Math.max(0, totalAmount - couponDiscount);

    // Apply bank/UPI payment offer if provided — re-validated here rather than trusting
    // any discount figure computed client-side, since this determines the amount charged.
    let bankOfferDiscount = 0;
    let appliedBankOffer: any = null;
    if (data.bankOfferId) {
      const offer = await this.prisma.paymentOffer.findUnique({ where: { id: data.bankOfferId } });
      const now = new Date();
      const cartProductIds = new Set(cart.items.map((item) => item.productId));
      const cartCategoryIds = new Set(cart.items.map((item) => item.product?.categoryId).filter(Boolean));
      const isEligible =
        offer &&
        offer.isActive &&
        offer.startDate <= now &&
        offer.endDate >= now &&
        (!offer.productId || cartProductIds.has(offer.productId)) &&
        (!offer.categoryId || cartCategoryIds.has(offer.categoryId)) &&
        (!offer.minOrderValue || totalAmount >= Number(offer.minOrderValue));

      if (isEligible) {
        bankOfferDiscount =
          offer!.type === 'PERCENTAGE' ? totalAmount * (Number(offer!.value) / 100) : Number(offer!.value);
        if (offer!.maxDiscount) bankOfferDiscount = Math.min(bankOfferDiscount, Number(offer!.maxDiscount));
        bankOfferDiscount = Math.min(bankOfferDiscount, totalAmount);
        appliedBankOffer = offer;
      }
    }

    totalAmount = Math.max(0, totalAmount - bankOfferDiscount);

    const combinedNotes = appliedBankOffer
      ? [data.notes, `Bank offer applied: ${appliedBankOffer.name} (-₹${bankOfferDiscount.toFixed(2)})`].filter(Boolean).join(' | ')
      : data.notes;

    const breakdown = await this.computeAmountBreakdown(subtotal, couponDiscount + bankOfferDiscount, ruleResult);

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount: breakdown.totalAmount,
        subtotal: breakdown.subtotal,
        taxAmount: breakdown.taxAmount,
        cgstAmount: breakdown.cgstAmount,
        sgstAmount: breakdown.sgstAmount,
        igstAmount: breakdown.igstAmount,
        shippingAmount: breakdown.shippingAmount,
        discountAmount: breakdown.discountAmount,
        roundOffAmount: breakdown.roundOffAmount,
        currency: 'INR',
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress || data.shippingAddress,
        notes: combinedNotes,
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Increment coupon usage if applied
    if (appliedCoupon) {
      await this.prisma.coupon.update({
        where: { id: appliedCoupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    await this.prisma.cartItem.deleteMany({ where: { cartId } });

    // First order for this customer: save the shipping address they entered
    // as their default, so it pre-fills automatically at checkout next time,
    // rather than only via the separate account/addresses management page.
    // Only when they have no saved address yet — a later order shipped
    // somewhere else shouldn't silently overwrite whatever they've since set
    // as their default.
    try {
      const hasSavedAddress = (await this.prisma.address.count({ where: { userId } })) > 0;
      if (!hasSavedAddress && data.shippingAddress?.street) {
        await this.prisma.address.create({
          data: {
            userId,
            street: data.shippingAddress.street,
            city: data.shippingAddress.city,
            state: data.shippingAddress.state,
            zip: data.shippingAddress.zip,
            country: data.shippingAddress.country || 'India',
            isDefault: true,
          },
        });
      }
    } catch (err) {
      console.error('Failed to auto-save address from first order:', err.message);
    }

    // Reserve inventory for each order item
    for (const item of order.items) {
      try {
        await this.inventoryService.reserveStock(item.productId, item.quantity, order.id, userId, (item as any).variantId);
      } catch (err) {
        console.error(`Failed to reserve stock for product ${item.productId}:`, err.message);
      }
    }

    // Send order confirmation email
    if (order.user?.email && (await this.emailService.isConfigured())) {
      try {
        await this.emailService.sendOrderConfirmation(order.user.email, order.orderNumber.slice(0, 8), Number(order.totalAmount));
      } catch (err) {
        console.error('Failed to send order confirmation email:', err.message);
      }
    }

    return {
      ...order,
      couponDiscount,
      bankOfferDiscount,
      appliedBankOffer: appliedBankOffer ? { id: appliedBankOffer.id, name: appliedBankOffer.name } : null,
    };
  }

  async createFromBulk(userId: string, items: { productId: string; quantity: number }[], data: { shippingAddress?: any; notes?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const orderItemsData: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
    let totalAmount = 0;
    const errors: string[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) { errors.push(`Product ${item.productId} not found`); continue; }
      if (product.status !== 'PUBLISHED') { errors.push(`Product "${product.title}" is not available`); continue; }
      if (product.moq > item.quantity) { errors.push(`Product "${product.title}" requires minimum order quantity of ${product.moq}`); continue; }
      if (product.manageInventory && product.inventoryQuantity < item.quantity) {
        errors.push(`Product "${product.title}" has only ${product.inventoryQuantity} in stock`);
        continue;
      }

      const unitPrice = Number(product.unitPrice);
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;
      orderItemsData.push({ productId: item.productId, quantity: item.quantity, unitPrice, totalPrice });
    }

    if (orderItemsData.length === 0) {
      throw new BadRequestException(`No valid items to order. Errors: ${errors.join('; ')}`);
    }

    // Enforce dynamic rules before creating the order
    const bulkCartItems: CartItemContext[] = orderItemsData.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const ruleResult = await this.rulesEnforcement.enforceOrderRules({
      userId,
      userRole: (user as any)?.effectiveRole || (user as any)?.roleRel?.name || user?.role || undefined,
      cartItems: bulkCartItems,
      subtotal: totalAmount,
      shippingRegion: data.shippingAddress?.state || undefined,
      sellerState: await this.getSellerState(),
    });

    const breakdown = await this.computeAmountBreakdown(totalAmount, 0, ruleResult);

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount: breakdown.totalAmount,
        subtotal: breakdown.subtotal,
        taxAmount: breakdown.taxAmount,
        cgstAmount: breakdown.cgstAmount,
        sgstAmount: breakdown.sgstAmount,
        igstAmount: breakdown.igstAmount,
        shippingAmount: breakdown.shippingAmount,
        discountAmount: breakdown.discountAmount,
        roundOffAmount: breakdown.roundOffAmount,
        currency: 'INR',
        shippingAddress: data.shippingAddress || null,
        notes: data.notes || (errors.length > 0 ? `Bulk order. Skipped items: ${errors.join('; ')}` : 'Bulk order'),
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    for (const item of order.items) {
      try {
        await this.inventoryService.reserveStock(item.productId, item.quantity, order.id, userId);
      } catch (err) {
        console.error(`Failed to reserve stock for product ${item.productId}:`, err.message);
      }
    }

    if (order.user?.email && (await this.emailService.isConfigured())) {
      try {
        await this.emailService.sendOrderConfirmation(order.user.email, order.orderNumber.slice(0, 8), Number(order.totalAmount));
      } catch (err) {
        console.error('Failed to send order confirmation email:', err.message);
      }
    }

    return { order, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Items bought as a variant show it through the existing product fields, so every order view
   * (customer, admin, invoice) needs no changes: "Phone (Black / 128 GB)" and the variant's SKU,
   * taken from the snapshot saved on the order item.
   */
  private withVariantDetails<T extends { items?: any[] }>(order: T): T {
    for (const item of order?.items || []) {
      const v = item.metadata?.variant;
      if (!v || !item.product) continue;
      item.product = {
        ...item.product,
        title: v.label ? `${item.product.title} (${v.label})` : item.product.title,
        ...(v.sku ? { sku: v.sku } : {}),
      };
    }
    return order;
  }

  async findAll(userId?: string, status?: OrderStatus) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } },
        payment: { include: { refunds: { orderBy: { createdAt: 'desc' } } } },
        deliveryPartner: true,
        deliveryTracking: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => this.withVariantDetails(o));
  }

  async findById(id: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        payment: { include: { refunds: { orderBy: { createdAt: 'desc' } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, gstin: true } },
        deliveryPartner: true,
        deliveryTracking: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (userId && order.userId !== userId) throw new NotFoundException('Order not found');

    return this.withVariantDetails(order);
  }

  // ─── Admin: create / edit orders ───

  /** Product picker for the admin order forms: matches name or SKU, with each product's live variants. */
  async adminSearchProducts(q?: string) {
    const term = (q || '').trim();
    const products = await this.prisma.product.findMany({
      where: {
        status: { in: ['PUBLISHED', 'DRAFT'] as any },
        ...(term
          ? {
              OR: [
                { title: { contains: term, mode: 'insensitive' } },
                { sku: { contains: term, mode: 'insensitive' } },
                { variants: { some: { sku: { contains: term, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        sku: true,
        thumbnail: true,
        unitPrice: true,
        hasVariants: true,
        variantOptions: true,
        inventoryQuantity: true,
        reservedQuantity: true,
        variants: {
          where: { ...LIVE_VARIANTS_WHERE, isActive: true },
          orderBy: { position: 'asc' },
          select: { id: true, sku: true, options: true, price: true, inventoryQuantity: true, reservedQuantity: true },
        },
      },
      orderBy: { title: 'asc' },
      take: 20,
    });
    return products.map((p: any) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      thumbnail: p.thumbnail,
      unitPrice: Number(p.unitPrice),
      hasVariants: p.hasVariants,
      available: p.inventoryQuantity - p.reservedQuantity,
      variants: p.variants.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        label: variantLabel(v.options as any, p.variantOptions as any),
        price: Number(v.price),
        available: v.inventoryQuantity - v.reservedQuantity,
      })),
    }));
  }

  /**
   * Refuses lines that ask for more than is in stock (per product, or per variant). `alreadyHeld` is what the
   * order being edited has reserved already, which is free to keep. Products that allow backorders or do not
   * manage inventory are exempt.
   */
  private async assertStockAvailable(rows: { productId: string; variantId: string | null; quantity: number }[], alreadyHeld: Map<string, number> = new Map()) {
    const wanted = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
    for (const r of rows) {
      const k = `${r.productId}|${r.variantId || ''}`;
      const cur = wanted.get(k);
      if (cur) cur.quantity += r.quantity;
      else wanted.set(k, { ...r });
    }
    for (const [k, w] of wanted) {
      const product = await this.prisma.product.findUnique({ where: { id: w.productId } });
      if (!product || product.allowBackorder || !product.manageInventory) continue;
      let name = product.title;
      let available: number;
      if (w.variantId) {
        const v = await this.prisma.productVariant.findUnique({ where: { id: w.variantId } });
        if (!v) continue;
        available = v.inventoryQuantity - v.reservedQuantity;
        name = `${product.title} (${v.sku})`;
      } else {
        available = product.inventoryQuantity - product.reservedQuantity;
      }
      available += alreadyHeld.get(k) || 0;
      if (w.quantity > Math.max(0, available)) {
        throw new BadRequestException(
          available <= 0 ? `"${name}" is out of stock` : `Only ${available} of "${name}" in stock, but ${w.quantity} requested`,
        );
      }
    }
  }

  /** Validates the admin's lines against the catalogue and builds the rows to store (with variant snapshot in metadata). */
  private async buildAdminItemRows(items: AdminOrderItemDto[], existingMeta: Map<string, any> = new Map()) {
    const rows: any[] = [];
    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);

      let metadata: any = item.id ? existingMeta.get(item.id) ?? undefined : undefined;
      let variantId: string | null = null;
      if ((product as any).hasVariants) {
        if (!item.variantId) throw new BadRequestException(`Choose a variant for "${product.title}"`);
      }
      if (item.variantId) {
        const variant = await this.prisma.productVariant.findFirst({ where: { id: item.variantId, productId: product.id } });
        if (!variant) throw new BadRequestException(`Variant not found for "${product.title}"`);
        variantId = variant.id;
        metadata = {
          ...(metadata || {}),
          variant: {
            id: variant.id,
            sku: variant.sku,
            options: variant.options,
            label: variantLabel(variant.options as any, (product as any).variantOptions as any),
          },
        };
      } else if (metadata?.variant) {
        metadata = { ...metadata };
        delete metadata.variant;
      }

      const unitPrice = Math.round(item.unitPrice * 100) / 100;
      rows.push({
        id: item.id,
        productId: product.id,
        variantId,
        quantity: item.quantity,
        unitPrice,
        totalPrice: Math.round(unitPrice * item.quantity * 100) / 100,
        metadata,
      });
    }
    return rows;
  }

  /**
   * Amount breakdown for an admin-edited / admin-made order. GST follows `taxRates` (percent of the
   * subtotal, split CGST / SGST / IGST). If the admin typed a grand total, the gap to the calculated
   * total is stored as round off so the invoice still balances.
   */
  private async computeAdminAmounts(
    subtotal: number,
    discountAmount: number,
    shippingAmount: number,
    taxRates: { cgst: number; sgst: number; igst: number },
    totalOverride?: number,
  ) {
    const cgstAmount = Math.round(subtotal * taxRates.cgst) / 100;
    const sgstAmount = Math.round(subtotal * taxRates.sgst) / 100;
    const igstAmount = Math.round(subtotal * taxRates.igst) / 100;
    const taxAmount = cgstAmount + sgstAmount + igstAmount;
    const rawTotal = Math.max(0, subtotal - discountAmount) + taxAmount + shippingAmount;

    let totalAmount: number;
    if (totalOverride !== undefined && totalOverride !== null) {
      totalAmount = totalOverride;
    } else {
      const settings = await this.settingsService.findAll();
      totalAmount = settings.roundOffEnabled === 'true' ? Math.round(rawTotal) : rawTotal;
    }
    totalAmount = Math.round(totalAmount * 100) / 100;
    const roundOffAmount = Math.round((totalAmount - rawTotal) * 100) / 100;
    return { subtotal, taxAmount, cgstAmount, sgstAmount, igstAmount, shippingAmount, discountAmount, roundOffAmount, totalAmount };
  }

  /** The price each line would cost this customer for its quantity: their role price, contract price, tier or base price. */
  async adminQuotePrices(userId: string, items: { productId: string; variantId?: string | null; quantity: number }[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Customer not found');
    const prices: { productId: string; variantId: string | null; unitPrice: number; appliedRule: string; roleName: string | null }[] = [];
    for (const it of items) {
      try {
        const p = await this.pricingService.calculateEffectivePrice(it.productId, Math.max(1, Math.floor(it.quantity || 1)), userId, it.variantId || undefined);
        prices.push({ productId: it.productId, variantId: it.variantId || null, unitPrice: Math.round(p.finalPrice * 100) / 100, appliedRule: p.appliedRule, roleName: p.appliedRoleName });
      } catch {
        // Unknown product / variant: the editor keeps whatever price the line already has.
        prices.push({ productId: it.productId, variantId: it.variantId || null, unitPrice: null as any, appliedRule: 'base', roleName: null });
      }
    }
    return { prices };
  }

  /** GST rates (% of subtotal) and the default shipping charge the rules give an admin-made order for this customer / state. */
  async adminPricingRules(userId: string, state: string | undefined, items: { productId: string; quantity: number; unitPrice: number }[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Customer not found');
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const ruleResult = await this.rulesEnforcement.evaluate({
      userId: user.id,
      userRole: (user as any)?.effectiveRole || user?.role || undefined,
      cartItems: items.map((r) => ({ productId: r.productId, quantity: r.quantity, unitPrice: r.unitPrice })),
      subtotal,
      shippingRegion: state || undefined,
      sellerState: await this.getSellerState(),
    });
    const pct = (key: 'cgstRate' | 'sgstRate' | 'igstRate') => ruleResult.taxes.reduce((sum, t: any) => sum + (t[key] || 0), 0);
    return {
      rates: { cgst: pct('cgstRate'), sgst: pct('sgstRate'), igst: pct('igstRate') },
      shipping: ruleResult.shipping?.cost ?? 0,
    };
  }

  async adminCreateOrder(adminId: string, dto: AdminCreateOrderDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Customer not found');

    const rows = await this.buildAdminItemRows(dto.items);
    await this.assertStockAvailable(rows);
    const subtotal = rows.reduce((sum, r) => sum + r.totalPrice, 0);

    // Tax (and a default shipping charge) come from the same rules the storefront uses, but nothing is
    // enforced — an admin can order below a minimum quantity, etc.
    const pricing = await this.adminPricingRules(user.id, dto.shippingAddress?.state, rows);
    const amounts = await this.computeAdminAmounts(
      subtotal,
      dto.discountAmount ?? 0,
      dto.shippingAmount ?? pricing.shipping,
      pricing.rates,
      dto.totalAmount,
    );

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        ...amounts,
        currency: 'INR',
        shippingAddress: dto.shippingAddress as any,
        billingAddress: dto.billingAddress as any,
        notes: dto.notes || null,
        items: { create: rows.map(({ id: _id, ...r }) => r) },
        // Every order carries a payment record so its status can be tracked and changed; admin-made orders start as Cash on Delivery.
        payment: { create: { provider: 'COD', amount: amounts.totalAmount, status: PaymentStatus.PENDING } },
      },
    });

    for (const item of rows) {
      try {
        await this.inventoryService.reserveStock(item.productId, item.quantity, order.id, adminId, item.variantId);
      } catch (err) {
        console.error(`Failed to reserve stock for product ${item.productId}:`, err.message);
      }
    }

    return this.findById(order.id);
  }

  async adminUpdateOrder(adminId: string, id: string, dto: AdminUpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true, payment: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('A cancelled order cannot be edited');

    const existing = new Map(order.items.map((i) => [i.id, i]));
    for (const item of dto.items) {
      if (item.id && !existing.has(item.id)) throw new BadRequestException('An order line does not belong to this order');
    }
    const rows = await this.buildAdminItemRows(dto.items, new Map(order.items.map((i) => [i.id, i.metadata])));
    // Reservations only exist until the goods ship; after that stock has already been taken off.
    const reservationHeld = (['PENDING', 'CONFIRMED', 'PROCESSING'] as string[]).includes(order.status);
    if (reservationHeld) {
      const held = new Map<string, number>();
      for (const i of order.items) held.set(`${i.productId}|${i.variantId || ''}`, (held.get(`${i.productId}|${i.variantId || ''}`) || 0) + i.quantity);
      await this.assertStockAvailable(rows, held);
    }
    const subtotal = rows.reduce((sum, r) => sum + r.totalPrice, 0);

    // Keep the order's own GST rates (as % of subtotal) so the new quantities / prices are taxed the same way.
    const oldSubtotal = Number(order.subtotal ?? 0);
    const rate = (amount: any) => (oldSubtotal > 0 ? (Number(amount ?? 0) / oldSubtotal) * 100 : 0);
    const amounts = await this.computeAdminAmounts(
      subtotal,
      dto.discountAmount ?? Number(order.discountAmount ?? 0),
      dto.shippingAmount ?? Number(order.shippingAmount ?? 0),
      { cgst: rate(order.cgstAmount), sgst: rate(order.sgstAmount), igst: rate(order.igstAmount) },
      dto.totalAmount,
    );

    const key = (productId: string, variantId?: string | null) => `${productId}|${variantId || ''}`;
    const oldQty = new Map<string, number>();
    for (const i of order.items) oldQty.set(key(i.productId, i.variantId), (oldQty.get(key(i.productId, i.variantId)) || 0) + i.quantity);
    const newQty = new Map<string, number>();
    for (const r of rows) newQty.set(key(r.productId, r.variantId), (newQty.get(key(r.productId, r.variantId)) || 0) + r.quantity);

    await this.prisma.$transaction(async (tx) => {
      const keepIds = rows.filter((r) => r.id).map((r) => r.id as string);
      await tx.orderItem.deleteMany({ where: { orderId: id, id: { notIn: keepIds } } });
      for (const r of rows) {
        const { id: lineId, ...data } = r;
        if (lineId) {
          await tx.orderItem.update({ where: { id: lineId }, data: { ...data, metadata: data.metadata ?? undefined } });
        } else {
          await tx.orderItem.create({ data: { ...data, orderId: id } });
        }
      }
      await tx.order.update({
        where: { id },
        data: {
          ...amounts,
          shippingAddress: dto.shippingAddress as any,
          billingAddress: dto.billingAddress as any,
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        },
      });
      // A payment that has not been captured yet should ask for the new amount.
      if (order.payment && order.payment.status !== PaymentStatus.CAPTURED && order.payment.status !== PaymentStatus.REFUNDED) {
        await tx.payment.update({ where: { id: order.payment.id }, data: { amount: amounts.totalAmount } });
      }
    });

    if (reservationHeld) {
      const keys = new Set([...oldQty.keys(), ...newQty.keys()]);
      for (const k of keys) {
        const delta = (newQty.get(k) || 0) - (oldQty.get(k) || 0);
        if (delta === 0) continue;
        const [productId, variantId] = k.split('|');
        try {
          if (delta > 0) await this.inventoryService.reserveStock(productId, delta, id, adminId, variantId || null);
          else await this.inventoryService.releaseStock(productId, -delta, id, adminId, variantId || null);
        } catch (err) {
          console.error(`Failed to adjust stock for product ${productId}:`, err.message);
        }
      }
    }

    if (!reservationHeld && (order.status === 'SHIPPED' || order.status === 'DELIVERED')) {
      const keys = new Set([...oldQty.keys(), ...newQty.keys()]);
      for (const k of keys) {
        const delta = (newQty.get(k) || 0) - (oldQty.get(k) || 0);
        const [productId, variantId] = k.split('|');
        try {
          await this.inventoryService.adjustShippedQuantity(productId, variantId || null, delta, id, adminId);
        } catch (err) {
          console.error(`Failed to adjust stock for product ${productId}:`, err.message);
        }
      }
    }

    return this.findById(id);
  }

  async updateStatus(id: string, status: OrderStatus) {
    const before = await this.prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw new NotFoundException('Order not found');
    const order = await this.prisma.order.update({
      where: { id },
      data: { status, ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) },
      include: {
        items: { include: { product: { select: { id: true, title: true, categoryId: true } } } },
        payment: true,
        user: { select: { id: true, role: true, referredBy: true } },
      },
    });

    // Shipping/delivering takes the units out of inventory; cancelling frees them.
    try {
      await this.inventoryService.applyOrderStatusChange(id, before.status, status);
    } catch (err) {
      this.logger.error(`Failed to update stock for order ${id}: ${err.message}`);
    }

    try {
      await syncPaymentWithOrderStatus(this.prisma, id, status);
    } catch (err) {
      this.logger.error(`Failed to sync payment for order ${id}: ${err.message}`);
    }

    await this.notifyOrderStatus(order.userId, order.id, order.orderNumber, status);

    // Award loyalty points on delivery
    if (status === 'DELIVERED') {
      try {
        const orderItems = order.items.map((item) => ({
          productId: item.productId,
          categoryId: item.product?.categoryId || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        }));

        // Check if this is the user's first delivered order
        const deliveredCount = await this.prisma.order.count({
          where: { userId: order.userId, status: { in: ['DELIVERED', 'CONFIRMED'] } },
        });
        const isFirstOrder = deliveredCount <= 1;

        await this.loyaltyEarningService.evaluateAndAward(order.userId, 'ORDER_COMPLETED', {
          orderId: order.id,
          orderAmount: Number(order.totalAmount),
          orderItems,
          isFirstOrder,
          userRole: order.user?.role,
          referredBy: order.user?.referredBy || undefined,
        });
      } catch (err) {
        this.logger.error(`Failed to award loyalty points for order ${order.id}: ${err.message}`);
      }
    }

    return order;
  }

  async updateTracking(id: string, data: { trackingNumber?: string; carrier?: string; shippingEta?: string; deliveryPartnerId?: string }) {
    const updateData: any = {};
    if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
    if (data.shippingEta !== undefined) updateData.shippingEta = new Date(data.shippingEta);

    if (data.deliveryPartnerId) {
      const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: data.deliveryPartnerId } });
      if (partner) {
        updateData.deliveryPartnerId = data.deliveryPartnerId;
        updateData.carrier = partner.name;
      }
    } else if (data.carrier !== undefined) {
      updateData.carrier = data.carrier;
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        payment: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        deliveryPartner: true,
        deliveryTracking: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
      },
    });

    if (data.deliveryPartnerId || data.trackingNumber) {
      await this.prisma.deliveryTracking.upsert({
        where: { orderId: id },
        update: { status: DeliveryStatus.PENDING },
        create: { orderId: id, status: DeliveryStatus.PENDING },
      });
    }

    return order;
  }

  async cancelOrder(id: string, userId?: string) {
    const order = await this.findById(id, userId);
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot cancel this order');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: {
        items: { include: { product: { select: { id: true, title: true } } } },
        payment: true,
      },
    });

    await this.notifyOrderStatus(updated.userId, updated.id, updated.orderNumber, OrderStatus.CANCELLED);

    // Release reserved inventory (or put shipped units back)
    try {
      await this.inventoryService.applyOrderStatusChange(updated.id, order.status, OrderStatus.CANCELLED, userId);
    } catch (err) {
      console.error(`Failed to release stock for order ${updated.id}:`, err.message);
    }

    // A paid order that gets cancelled owes the buyer money back. Track that as a
    // Refund record (existing model, tied to Payment) starting at PENDING so an
    // admin can work it through the Approve -> Mark as Refunded flow below.
    // Razorpay itself is NOT called here - this is manual/internal tracking only.
    if (updated.payment && updated.payment.status === PaymentStatus.CAPTURED) {
      await this.prisma.refund.create({
        data: {
          paymentId: updated.payment.id,
          amount: updated.payment.amount,
          reason: 'Order cancelled',
          status: RefundStatus.PENDING,
          initiatedBy: userId ?? null,
        },
      });
      await this.prisma.payment.update({
        where: { id: updated.payment.id },
        data: { status: PaymentStatus.REFUND_PENDING },
      });
    }

    return this.findById(id);
  }

  private async getPaymentWithLatestRefund(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: { include: { refunds: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.payment) throw new BadRequestException('This order has no payment to refund');
    const refund = order.payment.refunds[0];
    if (!refund) throw new BadRequestException('No refund has been requested for this order');
    return { order, payment: order.payment, refund };
  }

  /** Refund Pending -> Approved. Money hasn't moved yet - this just acknowledges the request. */
  async approveRefund(orderId: string) {
    const { refund } = await this.getPaymentWithLatestRefund(orderId);
    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(`Only a pending refund can be approved (current status: ${refund.status})`);
    }
    await this.prisma.refund.update({ where: { id: refund.id }, data: { status: RefundStatus.APPROVED } });
    return this.findById(orderId);
  }

  /** Refund Pending -> Rejected. Payment reverts to CAPTURED since the money stays with the merchant. */
  async rejectRefund(orderId: string, reason?: string) {
    const { payment, refund } = await this.getPaymentWithLatestRefund(orderId);
    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(`Only a pending refund can be rejected (current status: ${refund.status})`);
    }
    await this.prisma.refund.update({
      where: { id: refund.id },
      data: { status: RefundStatus.REJECTED, reason: reason || refund.reason },
    });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.CAPTURED } });
    return this.findById(orderId);
  }

  /**
   * Approved -> Refunded. Marks the money as actually returned. The Razorpay refund
   * itself is performed manually by the admin outside this app for now - this only
   * records that it happened.
   */
  async markRefunded(orderId: string) {
    const { order, payment, refund } = await this.getPaymentWithLatestRefund(orderId);
    if (refund.status !== RefundStatus.APPROVED) {
      throw new BadRequestException(`Only an approved refund can be marked as refunded (current status: ${refund.status})`);
    }
    await this.prisma.refund.update({ where: { id: refund.id }, data: { status: RefundStatus.PROCESSED } });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } });

    // A refund tied to a cancelled order should stay Cancelled - REFUNDED is only for
    // orders that weren't already cancelled (e.g. a refund issued on a delivered order).
    const finalOrderStatus = order.status === OrderStatus.CANCELLED ? OrderStatus.CANCELLED : OrderStatus.REFUNDED;
    if (finalOrderStatus !== order.status) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: finalOrderStatus } });
    }
    await this.notifyOrderStatus(order.userId, order.id, order.orderNumber, finalOrderStatus);
    return this.findById(orderId);
  }

  async getDeliveryTracking(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        deliveryPartner: true,
        deliveryTracking: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    let trackingUrl: string | null = null;
    if (order.deliveryPartner?.trackingUrlTemplate && order.trackingNumber) {
      trackingUrl = order.deliveryPartner.trackingUrlTemplate.replace('{trackingNumber}', order.trackingNumber);
    }

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        shippingEta: order.shippingEta,
      },
      partner: order.deliveryPartner,
      trackingUrl,
      tracking: order.deliveryTracking,
    };
  }

  async addTrackingEvent(orderId: string, data: { status: DeliveryStatus; location?: string; notes?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    let tracking = await this.prisma.deliveryTracking.findUnique({ where: { orderId } });

    if (!tracking) {
      tracking = await this.prisma.deliveryTracking.create({
        data: { orderId, status: data.status },
      });
    }

    await this.prisma.deliveryTrackingEvent.create({
      data: {
        trackingId: tracking.id,
        status: data.status,
        location: data.location,
        notes: data.notes,
      },
    });

    await this.prisma.deliveryTracking.update({
      where: { id: tracking.id },
      data: {
        status: data.status,
        currentLocation: data.location || tracking.currentLocation,
      },
    });

    // Keep the order's own status roughly in sync with meaningful delivery milestones
    // (routed through updateStatus so it fires the usual order-status notification/loyalty logic).
    if (data.status === DeliveryStatus.DELIVERED) {
      await this.updateStatus(orderId, OrderStatus.DELIVERED);
    } else if (data.status === DeliveryStatus.PICKED_UP && order.status === OrderStatus.PROCESSING) {
      await this.updateStatus(orderId, OrderStatus.SHIPPED);
    }

    await this.notifyDeliveryStatus(order.userId, orderId, order.orderNumber, data.status);

    return this.getDeliveryTracking(orderId);
  }
}
