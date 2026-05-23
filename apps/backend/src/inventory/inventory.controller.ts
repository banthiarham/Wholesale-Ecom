import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List products with stock levels' })
  @ApiQuery({ name: 'vendorId', required: false, description: 'Filter by vendor' })
  @ApiResponse({ status: 200, description: 'Inventory list' })
  async getInventory(@Query('vendorId') vendorId?: string, @CurrentUser('id') userId?: string, @CurrentUser('role') role?: UserRole) {
    const effectiveVendorId = role === UserRole.ADMIN ? vendorId : userId;
    return this.inventoryService.getInventory(effectiveVendorId);
  }

  @Get(':productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product stock details' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  async getProduct(@Param('productId') productId: string) {
    return this.inventoryService.getProductInventory(productId);
  }

  @Post(':productId/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust product stock' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  async adjust(
    @Param('productId') productId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventoryService.adjustStock(productId, dto.adjustment, dto.reason, dto.notes, userId);
  }

  @Get(':productId/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get inventory logs for a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max log entries' })
  async getLogs(@Param('productId') productId: string, @Query('limit') limit?: string) {
    return this.inventoryService.getLogs(productId, limit ? parseInt(limit, 10) : 50);
  }
}
