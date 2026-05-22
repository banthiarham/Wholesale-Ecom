import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(orderId: string, provider: string, amount: number) {
    return this.prisma.payment.create({
      data: {
        orderId,
        provider,
        amount,
        status: PaymentStatus.PENDING,
      },
    });
  }

  async verify(orderId: string, providerRef: string, status: PaymentStatus) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    return this.prisma.payment.update({
      where: { orderId },
      data: { providerRef, status },
    });
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({ where: { orderId } });
  }
}
