import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyEarningService } from '../loyalty/loyalty-earning.service';
import { RulesEnforcementService } from '../rules/rules-enforcement.service';
import { CartItemContext } from '../rules/rules-engine.service';
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
  ) {}

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

  async createFromCart(userId: string, cartId: string, data: { shippingAddress: any; billingAddress?: any; notes?: string; couponCode?: string; bankOfferId?: string }) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    let totalAmount = 0;
    const orderItemsData = cart.items.map((item) => {
      const totalPrice = Number(item.unitPrice) * item.quantity;
      totalAmount += totalPrice;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: totalPrice,
        metadata: item.metadata, // Preserve package composition and pricing data
      };
    });

    // Enforce dynamic rules before creating the order
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const cartItemsContext: CartItemContext[] = cart.items.map((item) => ({
      productId: item.productId,
      categoryId: item.product?.categoryId || undefined,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    }));

    await this.rulesEnforcement.enforceOrderRules({
      userId,
      userRole: (user as any)?.effectiveRole || (user as any)?.roleRel?.name || user?.role || undefined,
      cartItems: cartItemsContext,
      subtotal: totalAmount,
    });

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

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount,
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

    // Reserve inventory for each order item
    for (const item of order.items) {
      try {
        await this.inventoryService.reserveStock(item.productId, item.quantity, order.id, userId);
      } catch (err) {
        console.error(`Failed to reserve stock for product ${item.productId}:`, err.message);
      }
    }

    // Send order confirmation email
    if (order.user?.email && this.emailService.isConfigured()) {
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

    await this.rulesEnforcement.enforceOrderRules({
      userId,
      userRole: (user as any)?.effectiveRole || (user as any)?.roleRel?.name || user?.role || undefined,
      cartItems: bulkCartItems,
      subtotal: totalAmount,
    });

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount,
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

    if (order.user?.email && this.emailService.isConfigured()) {
      try {
        await this.emailService.sendOrderConfirmation(order.user.email, order.orderNumber.slice(0, 8), Number(order.totalAmount));
      } catch (err) {
        console.error('Failed to send order confirmation email:', err.message);
      }
    }

    return { order, errors: errors.length > 0 ? errors : undefined };
  }

  async findAll(userId?: string, status?: OrderStatus) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return this.prisma.order.findMany({
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
  }

  async findById(id: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        payment: { include: { refunds: { orderBy: { createdAt: 'desc' } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        deliveryPartner: true,
        deliveryTracking: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (userId && order.userId !== userId) throw new NotFoundException('Order not found');

    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { id: true, title: true, categoryId: true } } } },
        payment: true,
        user: { select: { id: true, role: true, referredBy: true } },
      },
    });

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

    // Release reserved inventory
    for (const item of updated.items) {
      try {
        await this.inventoryService.releaseStock(item.productId, item.quantity, updated.id, userId);
      } catch (err) {
        console.error(`Failed to release stock for product ${item.productId}:`, err.message);
      }
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