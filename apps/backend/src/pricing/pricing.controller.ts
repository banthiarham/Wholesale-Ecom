import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Pricing — Engine')
@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate effective price for a product at a quantity' })
  @ApiResponse({ status: 200, description: 'Price calculation result' })
  @ApiQuery({ name: 'productId', required: true, description: 'Product UUID' })
  @ApiQuery({ name: 'quantity', required: true, description: 'Order quantity', type: Number })
  @ApiQuery({ name: 'userId', required: false, description: 'User UUID for contract & role pricing' })
  async calculate(
    @Query('productId') productId: string,
    @Query('quantity') quantity: string,
    @Query('userId') userId?: string,
  ) {
    const result = await this.pricingService.calculateEffectivePrice(
      productId,
      parseInt(quantity, 10),
      userId,
    );
    return result;
  }

  @Get('calculate-role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview effective price for a specific role (Admin only)' })
  @ApiQuery({ name: 'productId', required: true, description: 'Product UUID' })
  @ApiQuery({ name: 'quantity', required: true, description: 'Order quantity', type: Number })
  @ApiQuery({ name: 'roleId', required: true, description: 'Role UUID to preview pricing for' })
  async calculateForRole(
    @Query('productId') productId: string,
    @Query('quantity') quantity: string,
    @Query('roleId') roleId: string,
  ) {
    const result = await this.pricingService.calculatePriceForRole(
      productId,
      parseInt(quantity, 10),
      roleId,
    );
    return result;
  }
}