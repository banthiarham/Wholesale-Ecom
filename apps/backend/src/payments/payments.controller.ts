import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentStatus } from '@prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: { orderId: string; provider: string; amount: number }) {
    const payment = await this.paymentsService.create(
      body.orderId,
      body.provider,
      body.amount,
    );
    return { payment };
  }

  @Post(':orderId/verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @Param('orderId') orderId: string,
    @Body() body: { providerRef: string; status: PaymentStatus },
  ) {
    const payment = await this.paymentsService.verify(
      orderId,
      body.providerRef,
      body.status,
    );
    return { payment };
  }
}
