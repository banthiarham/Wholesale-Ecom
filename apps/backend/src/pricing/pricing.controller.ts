import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
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
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate effective price for a product at a quantity' })
  @ApiResponse({ status: 200, description: 'Price calculation result' })
  @ApiQuery({ name: 'productId', required: true, description: 'Product UUID' })
  @ApiQuery({ name: 'quantity', required: true, description: 'Order quantity', type: Number })
  @ApiQuery({ name: 'userId', required: false, description: 'User UUID for contract & role pricing' })
  async calculate(
    @Req() req: any,
    @Query('productId') productId: string,
    @Query('quantity') quantity: string,
    @Query('userId') userId?: string,
  ) {
    // Contract and role prices are private to the buyer: they are resolved from the signed-in
    // user. A `userId` query value is only honoured for admins (price preview), never anonymously.
    const authUser = req.user;
    const effectiveUserId = authUser ? (authUser.role === 'ADMIN' && userId ? userId : authUser.id) : undefined;
    const result = await this.pricingService.calculateEffectivePrice(
      productId,
      parseInt(quantity, 10),
      effectiveUserId,
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