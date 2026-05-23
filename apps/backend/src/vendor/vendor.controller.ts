import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VendorService } from './vendor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Vendor')
@Controller('vendor')
export class VendorController {
  constructor(private vendorService: VendorService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vendor dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async dashboard(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    const vendorId = role === UserRole.ADMIN ? undefined : userId;
    return this.vendorService.getDashboard(vendorId || userId);
  }

  @Get('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vendor products list' })
  async products(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    const vendorId = role === UserRole.ADMIN ? undefined : userId;
    return this.vendorService.getProducts(vendorId || userId);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Orders containing vendor products' })
  async orders(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    const vendorId = role === UserRole.ADMIN ? undefined : userId;
    return this.vendorService.getOrders(vendorId || userId);
  }

  @Get('rfqs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open RFQs awaiting quotes' })
  async rfqs() {
    return this.vendorService.getRfqs();
  }

  @Get('sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sales analytics' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look back' })
  async sales(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Query('days') days?: string) {
    const vendorId = role === UserRole.ADMIN ? undefined : userId;
    return this.vendorService.getSales(vendorId || userId, days ? parseInt(days, 10) : 30);
  }
}
