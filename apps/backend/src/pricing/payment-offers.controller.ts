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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { PaymentOffersService } from './payment-offers.service';
import { CreatePaymentOfferDto } from './dto/create-payment-offer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Pricing — Payment Offers')
@Controller('pricing/payment-offers')
export class PaymentOffersController {
  constructor(private service: PaymentOffersService) {}

  @Get()
  @ApiOperation({ summary: 'List all payment offers' })
  @ApiResponse({ status: 200, description: 'Payment offers retrieved' })
  async findAll() {
    const offers = await this.service.findAll();
    return { offers, count: offers.length };
  }

  @Get('applicable')
  @ApiOperation({ summary: 'Get applicable payment offers for a product/category' })
  @ApiQuery({ name: 'productId', required: false, description: 'Product ID' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Applicable offers retrieved' })
  async findApplicable(
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const offers = await this.service.findApplicable(productId, categoryId);
    return { offers };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment offer by ID' })
  @ApiResponse({ status: 200, description: 'Offer found' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  @ApiParam({ name: 'id', description: 'Payment offer UUID' })
  async findById(@Param('id') id: string) {
    const offer = await this.service.findById(id);
    return { offer };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment offer (Admin only)' })
  @ApiResponse({ status: 201, description: 'Offer created' })
  @ApiBody({ type: CreatePaymentOfferDto })
  async create(@Body() dto: CreatePaymentOfferDto) {
    const offer = await this.service.create(dto);
    return { offer };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a payment offer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Offer updated' })
  @ApiParam({ name: 'id', description: 'Payment offer UUID' })
  @ApiBody({ type: CreatePaymentOfferDto })
  async update(@Param('id') id: string, @Body() dto: CreatePaymentOfferDto) {
    const offer = await this.service.update(id, dto);
    return { offer };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a payment offer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Offer deleted' })
  @ApiParam({ name: 'id', description: 'Payment offer UUID' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}