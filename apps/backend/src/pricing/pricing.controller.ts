import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Pricing — Engine')
@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate effective price for a product at a quantity' })
  @ApiResponse({ status: 200, description: 'Price calculation result' })
  @ApiQuery({ name: 'productId', required: true, description: 'Product UUID' })
  @ApiQuery({ name: 'quantity', required: true, description: 'Order quantity', type: Number })
  @ApiQuery({ name: 'userId', required: false, description: 'User UUID for contract pricing' })
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
}
