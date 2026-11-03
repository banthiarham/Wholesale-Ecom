import { PaymentStatus } from '@prisma/client';

/**
 * Keeps the payment record in step with the order: once an order is Confirmed, Processing, Shipped or Delivered
 * its payment counts as received. Cash on Delivery is only collected at the door, so it waits for Delivered.
 * Captured and refunded payments are never touched.
 */
export async function syncPaymentWithOrderStatus(db: { payment: any; order: any }, orderId: string, orderStatus: string) {
  if (!['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(orderStatus)) return;
  let payment = await db.payment.findUnique({ where: { orderId } });
  if (!payment) {
    // An order without a payment record (e.g. made by an admin before records were created): add one as Cash on Delivery.
    const order = await db.order.findUnique({ where: { id: orderId }, select: { totalAmount: true } });
    if (!order) return;
    payment = await db.payment.create({ data: { orderId, provider: 'COD', amount: order.totalAmount, status: PaymentStatus.PENDING } });
  }
  if (!([PaymentStatus.PENDING, PaymentStatus.AUTHORIZED, PaymentStatus.FAILED, PaymentStatus.CANCELLED] as string[]).includes(payment.status)) return;
  if (payment.provider === 'COD' && orderStatus !== 'DELIVERED') return;
  await db.payment.update({ where: { orderId }, data: { status: PaymentStatus.CAPTURED } });
}
