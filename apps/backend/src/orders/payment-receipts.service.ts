import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const RECEIPT_METHODS = ['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'CARD', 'OTHER'] as const;
export type ReceiptStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface ReceiptInput {
  amount: number;
  method: string;
  reference?: string;
  receivedAt?: string;
  note?: string;
  proofUrl?: string;
  proofName?: string;
}

interface Actor { id: string; isAdmin: boolean }

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Payment states receipts may move between; refunds and refunded payments are left alone. */
const RECEIPT_DRIVEN: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED, PaymentStatus.FAILED];

/**
 * Part payments ("receipts") against an order. The order's payment record stays the bill; receipts are
 * the money that came in. Once an order has receipts, the verified ones decide whether it is paid.
 */
@Injectable()
export class PaymentReceiptsService {
  private readonly logger = new Logger(PaymentReceiptsService.name);

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  /** Paid / pending / balance for a payment and its receipts (works on rows already loaded). */
  static summarize(total: number, payment: { status: string; receipts?: { amount: any; status: string }[] } | null) {
    const receipts = payment?.receipts || [];
    const verified = round2(receipts.filter((r) => r.status === 'VERIFIED').reduce((s, r) => s + Number(r.amount), 0));
    const pending = round2(receipts.filter((r) => r.status === 'PENDING_VERIFICATION').reduce((s, r) => s + Number(r.amount), 0));
    const hasReceipts = receipts.some((r) => r.status !== 'REJECTED');
    // Without receipts the old rule stands: a captured payment means the whole order is paid.
    const paid = hasReceipts ? verified : payment?.status === PaymentStatus.CAPTURED ? total : 0;
    const balance = round2(Math.max(0, total - paid));
    const state = paid <= 0 ? 'UNPAID' : paid + 0.005 < total ? 'PARTIALLY_PAID' : paid > total + 0.005 ? 'OVERPAID' : 'PAID';
    return { total: round2(total), paid: round2(paid), pendingVerification: pending, balance, state, hasReceipts, receiptsTotal: verified };
  }

  private async loadOrder(orderId: string, actor: Actor) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: { include: { receipts: { orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }] } } } },
    });
    if (!order || (!actor.isAdmin && order.userId !== actor.id)) throw new NotFoundException('Order not found');
    return order;
  }

  async list(orderId: string, actor: Actor) {
    const order = await this.loadOrder(orderId, actor);
    return {
      summary: PaymentReceiptsService.summarize(Number(order.totalAmount), order.payment),
      receipts: order.payment?.receipts || [],
    };
  }

  async create(orderId: string, actor: Actor, input: ReceiptInput) {
    const order = await this.loadOrder(orderId, actor);
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('This order is cancelled');
    if (order.payment && ([PaymentStatus.REFUNDED, PaymentStatus.REFUND_PENDING] as string[]).includes(order.payment.status)) {
      throw new BadRequestException('This order has been refunded');
    }

    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter an amount greater than 0');
    const method = String(input.method || '').toUpperCase();
    if (!(RECEIPT_METHODS as readonly string[]).includes(method)) throw new BadRequestException('Choose how the payment was made');
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    if (isNaN(receivedAt.getTime())) throw new BadRequestException('Enter a valid payment date');
    if (receivedAt.getTime() > Date.now() + 86400000) throw new BadRequestException('The payment date cannot be in the future');

    // Receipts are counted against the order total on their own (a "captured" status without receipts doesn't use it up).
    const total = Number(order.totalAmount);
    const receipts = order.payment?.receipts || [];
    const verified = receipts.filter((r) => r.status === 'VERIFIED').reduce((s, r) => s + Number(r.amount), 0);
    const pending = receipts.filter((r) => r.status === 'PENDING_VERIFICATION').reduce((s, r) => s + Number(r.amount), 0);
    const room = round2(total - verified - (actor.isAdmin ? 0 : pending));
    if (amount > room + 0.005) {
      throw new BadRequestException(
        room <= 0
          ? actor.isAdmin ? 'This order is already fully paid' : 'Payments already received or awaiting verification cover this order'
          : `The amount can be at most ${room.toFixed(2)} (the balance${actor.isAdmin ? '' : ' not yet paid or awaiting verification'})`,
      );
    }

    const payment = order.payment
      ?? (await this.prisma.payment.create({ data: { orderId, provider: method, amount: total, status: PaymentStatus.PENDING } }));

    const receipt = await this.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        amount,
        method,
        reference: input.reference?.trim() || null,
        receivedAt,
        note: input.note?.trim() || null,
        proofUrl: input.proofUrl || null,
        proofName: input.proofName || null,
        status: actor.isAdmin ? 'VERIFIED' : 'PENDING_VERIFICATION',
        submittedBy: actor.id,
        submittedVia: actor.isAdmin ? 'ADMIN' : 'CUSTOMER',
        verifiedBy: actor.isAdmin ? actor.id : null,
        verifiedAt: actor.isAdmin ? new Date() : null,
      },
    });
    await this.recompute(payment.id);

    const label = order.invoiceNumber || `#${order.orderNumber.slice(0, 8).toUpperCase()}`;
    if (actor.isAdmin) {
      await this.notify(order.userId, 'Payment received', `We have received ₹${amount.toLocaleString('en-IN')} for order ${label}.`, { orderId, receiptId: receipt.id });
    } else {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      for (const a of admins) {
        await this.notify(a.id, 'Payment proof submitted', `A customer submitted a payment of ₹${amount.toLocaleString('en-IN')} for order ${label}. Please verify it.`, { orderId, receiptId: receipt.id });
      }
    }
    return this.list(orderId, actor);
  }

  async verify(orderId: string, receiptId: string, actor: Actor) {
    const { order, receipt } = await this.findReceipt(orderId, receiptId, actor);
    if (receipt.status === 'VERIFIED') return this.list(orderId, actor);
    const verified = (order.payment?.receipts || []).filter((r) => r.status === 'VERIFIED').reduce((s, r) => s + Number(r.amount), 0);
    if (verified + Number(receipt.amount) > Number(order.totalAmount) + 0.005) {
      throw new BadRequestException('Verifying this would take the amount received above the order total. Reject it or record the right amount instead.');
    }
    await this.prisma.paymentReceipt.update({ where: { id: receipt.id }, data: { status: 'VERIFIED', verifiedBy: actor.id, verifiedAt: new Date(), rejectReason: null } });
    await this.recompute(receipt.paymentId);
    const label = order.invoiceNumber || `#${order.orderNumber.slice(0, 8).toUpperCase()}`;
    await this.notify(order.userId, 'Payment verified', `Your payment of ₹${Number(receipt.amount).toLocaleString('en-IN')} for order ${label} has been verified.`, { orderId, receiptId });
    return this.list(orderId, actor);
  }

  async reject(orderId: string, receiptId: string, actor: Actor, reason?: string) {
    const { order, receipt } = await this.findReceipt(orderId, receiptId, actor);
    const why = reason?.trim();
    if (!why) throw new BadRequestException('Give a reason so the customer knows what to fix');
    await this.prisma.paymentReceipt.update({ where: { id: receipt.id }, data: { status: 'REJECTED', rejectReason: why, verifiedBy: actor.id, verifiedAt: new Date() } });
    await this.recompute(receipt.paymentId);
    const label = order.invoiceNumber || `#${order.orderNumber.slice(0, 8).toUpperCase()}`;
    await this.notify(order.userId, 'Payment not accepted', `Your payment of ₹${Number(receipt.amount).toLocaleString('en-IN')} for order ${label} could not be verified: ${why}`, { orderId, receiptId });
    return this.list(orderId, actor);
  }

  /** Admins can remove any receipt; customers only their own that are still awaiting verification. */
  async remove(orderId: string, receiptId: string, actor: Actor) {
    const { receipt } = await this.findReceipt(orderId, receiptId, actor, true);
    if (!actor.isAdmin && (receipt.submittedBy !== actor.id || receipt.status !== 'PENDING_VERIFICATION')) {
      throw new ForbiddenException('Only a payment still awaiting verification can be withdrawn');
    }
    await this.prisma.paymentReceipt.delete({ where: { id: receipt.id } });
    await this.recompute(receipt.paymentId);
    return this.list(orderId, actor);
  }

  /**
   * Keep the payment's status in step with its receipts: fully covered by verified receipts -> Captured,
   * otherwise Pending. Payments without receipts (paid online, or marked by hand) are not touched.
   */
  async recompute(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { receipts: true, order: { select: { status: true } } } });
    if (!payment || !RECEIPT_DRIVEN.includes(payment.status)) return;
    const meta = (payment.metadata as Record<string, any>) || {};
    const live = payment.receipts.filter((r) => r.status !== 'REJECTED');
    if (live.length === 0 && !meta.paidByReceipts) return;
    const verified = payment.receipts.filter((r) => r.status === 'VERIFIED').reduce((s, r) => s + Number(r.amount), 0);
    const full = verified + 0.005 >= Number(payment.amount);
    const status = full ? PaymentStatus.CAPTURED : PaymentStatus.PENDING;
    if (status !== payment.status || !!meta.paidByReceipts !== full) {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status, metadata: { ...meta, paidByReceipts: full } } });
    }
  }

  private async findReceipt(orderId: string, receiptId: string, actor: Actor, allowCustomer = false) {
    if (!actor.isAdmin && !allowCustomer) throw new ForbiddenException();
    const order = await this.loadOrder(orderId, actor);
    const receipt = order.payment?.receipts.find((r) => r.id === receiptId);
    if (!receipt) throw new NotFoundException('Payment not found');
    return { order, receipt };
  }

  private async notify(userId: string, title: string, message: string, data: any) {
    try {
      await this.notifications.createNotification(userId, 'PAYMENT', title, message, data);
    } catch (err: any) {
      this.logger.warn(`Notification failed: ${err?.message}`);
    }
  }
}
