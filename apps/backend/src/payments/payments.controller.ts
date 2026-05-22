import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentStatus } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment record for an order' })
  @ApiResponse({ status: 201, description: 'Payment record created' })
  @ApiBody({ type: CreatePaymentDto })
  async create(@Body() dto: CreatePaymentDto) {
    const payment = await this.paymentsService.create(
      dto.orderId,
      dto.provider,
      dto.amount,
    );
    return { payment };
  }

  @Post(':orderId/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify/update payment status for an order' })
  @ApiResponse({ status: 200, description: 'Payment verified' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiBody({ type: VerifyPaymentDto })
  async verify(
    @Param('orderId') orderId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    const payment = await this.paymentsService.verify(
      orderId,
      dto.providerRef,
      dto.status,
    );
    return { payment };
  }
}
