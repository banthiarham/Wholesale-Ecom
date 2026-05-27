import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { EmailService } from '../notifications/email.service';
import { OrderStatus, PaymentStatus, DeliveryStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private emailService: EmailService,
  ) {}

  async createFromCart(userId: string, cartId: string, data: { shippingAddress: any; billingAddress?: any; notes?: string; couponCode?: string }) {
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
      };
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

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount,
        currency: 'INR',
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress || data.shippingAddress,
        notes: data.notes,
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

    return order;
  }

  async findAll(userId?: string, status?: OrderStatus) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } },
        payment: true,
        deliveryPartner: true,
        deliveryTracking: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        payment: true,
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
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { id: true, title: true } } } },
        payment: true,
      },
    });
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

    if (data.deliveryPartnerId && data.trackingNumber) {
      await this.prisma.deliveryTracking.upsert({
        where: { orderId: id },
        update: {},
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

    // Release reserved inventory
    for (const item of updated.items) {
      try {
        await this.inventoryService.releaseStock(item.productId, item.quantity, updated.id, userId);
      } catch (err) {
        console.error(`Failed to release stock for product ${item.productId}:`, err.message);
      }
    }

    return updated;
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
    let tracking = await this.prisma.deliveryTracking.findUnique({ where: { orderId } });

    if (!tracking) {
      tracking = await this.prisma.deliveryTracking.create({
        data: { orderId, status: data.status },
      });
    }

    const event = await this.prisma.deliveryTrackingEvent.create({
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

    if (data.status === DeliveryStatus.DELIVERED) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });
    } else if (data.status === DeliveryStatus.PICKED_UP) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (order && order.status === OrderStatus.PROCESSING) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.SHIPPED },
        });
      }
    }

    return this.getDeliveryTracking(orderId);
  }
}
