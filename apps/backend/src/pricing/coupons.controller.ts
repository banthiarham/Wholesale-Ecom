import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { PricingService } from './pricing.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Pricing — Coupons')
@Controller('pricing/coupons')
export class CouponsController {
  constructor(
    private couponsService: CouponsService,
    private pricingService: PricingService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all coupons (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupons retrieved' })
  async findAll() {
    const coupons = await this.couponsService.findAll();
    return { coupons, count: coupons.length };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get coupon by code' })
  @ApiResponse({ status: 200, description: 'Coupon found' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  @ApiParam({ name: 'code', description: 'Coupon code' })
  async findByCode(@Param('code') code: string) {
    const coupon = await this.couponsService.findByCode(code);
    return { coupon };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a coupon (Admin only)' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiBody({ type: CreateCouponDto })
  async create(@Body() dto: CreateCouponDto) {
    const coupon = await this.couponsService.create(dto);
    return { coupon };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a coupon (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  @ApiBody({ type: CreateCouponDto })
  async update(@Param('id') id: string, @Body() dto: CreateCouponDto) {
    const coupon = await this.couponsService.update(id, dto);
    return { coupon };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a coupon (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon deleted' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Validate and apply a coupon to a subtotal' })
  @ApiResponse({ status: 200, description: 'Coupon validation result' })
  @ApiBody({ schema: { type: 'object', properties: { code: { type: 'string' }, subtotal: { type: 'number' } } } })
  async apply(
    @Body('code') code: string,
    @Body('subtotal') subtotal: number,
  ) {
    return this.pricingService.applyCoupon(code, subtotal);
  }
}
