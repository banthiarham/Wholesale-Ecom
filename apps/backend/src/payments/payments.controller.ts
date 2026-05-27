import { Controller, Post, Body, UseGuards, Param, Get, Req, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentStatus } from '@prisma/client';
import { Request, Response } from 'express';

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

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all payments' })
  @ApiResponse({ status: 200, description: 'List of all payments' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED'] })
  async findAll(@Query('status') status?: string) {
    const payments = await this.paymentsService.findAll(status);
    return { payments };
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

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details for an order' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  async findByOrderId(@Param('orderId') orderId: string) {
    const payment = await this.paymentsService.findByOrderId(orderId);
    return { payment };
  }

  // ─── Generic Payment Initiation ───

  @Post('initiate/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payment for an order using a configured gateway' })
  @ApiResponse({ status: 200, description: 'Payment initiation data returned' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiQuery({ name: 'provider', enum: ['RAZORPAY', 'CCAVENUE', 'STRIPE', 'PAYU'] })
  @ApiQuery({ name: 'returnUrl', required: false })
  async initiatePayment(
    @Param('orderId') orderId: string,
    @Query('provider') provider: string,
    @Query('returnUrl') returnUrl?: string,
  ) {
    const result = await this.paymentsService.initiatePayment(orderId, provider, returnUrl);
    return result;
  }

  // ─── Generic Callback Handler ───

  @Post('callback/:provider')
  @ApiOperation({ summary: 'Payment gateway callback handler (no auth — called by gateway)' })
  async handleCallback(
    @Param('provider') provider: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.paymentsService.handleCallback(provider, body);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = `${frontendUrl}/orders/${result.orderId}?payment=${result.paymentStatus.toLowerCase()}`;
      res.redirect(redirectUrl);
    } catch (err) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/orders?payment=error`);
    }
  }

  @Get('callback/:provider')
  @ApiOperation({ summary: 'Payment gateway GET callback handler (fallback)' })
  async handleCallbackGet(
    @Param('provider') provider: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    try {
      const result = await this.paymentsService.handleCallback(provider, query);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = `${frontendUrl}/orders/${result.orderId}?payment=${result.paymentStatus.toLowerCase()}`;
      res.redirect(redirectUrl);
    } catch (err) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/orders?payment=error`);
    }
  }

  // ─── CCAvenue (backward compatible) ───

  @Post('ccavenue/initiate/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate CCAvenue payment for an order' })
  @ApiResponse({ status: 200, description: 'Returns encrypted data for CCAvenue form submission' })
  @ApiResponse({ status: 400, description: 'CCAvenue not configured or order not found' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiQuery({ name: 'returnUrl', required: false, description: 'URL to redirect after payment' })
  async initiateCcavenue(
    @Param('orderId') orderId: string,
    @Query('returnUrl') returnUrl?: string,
  ) {
    const defaultReturnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/orders/${orderId}`;
    const result = await this.paymentsService.initiateCcavenue(
      orderId,
      returnUrl || defaultReturnUrl,
    );
    return result;
  }

  @Post('ccavenue/callback')
  @ApiOperation({ summary: 'CCAvenue payment callback handler (no auth — called by CCAvenue gateway)' })
  @ApiBody({ schema: { type: 'object', properties: { encResp: { type: 'string' } } } })
  async ccavenueCallback(
    @Body('encResp') encResp: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.paymentsService.handleCcavenueCallback(encResp);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = `${frontendUrl}/orders/${result.orderId}?payment=${result.paymentStatus.toLowerCase()}`;
      res.redirect(redirectUrl);
    } catch (err) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/orders?payment=error`);
    }
  }

  @Get('ccavenue/callback')
  @ApiOperation({ summary: 'CCAvenue GET callback handler (fallback)' })
  async ccavenueCallbackGet(
    @Query('encResp') encResp: string,
    @Res() res: Response,
  ) {
    return this.ccavenueCallback(encResp, res);
  }
}