import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sales overview' })
  getSalesOverview(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.analyticsService.getSalesOverview(startDate, endDate);
  }

  @Get('orders-by-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Orders grouped by status' })
  getOrdersByStatus(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.analyticsService.getOrdersByStatus(startDate, endDate);
  }

  @Get('top-products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Top selling products' })
  getTopProducts(@Query('limit') limit?: string) {
    return this.analyticsService.getTopProducts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('vendor/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vendor analytics' })
  getVendorAnalytics(@Param('id') vendorId: string) {
    return this.analyticsService.getVendorAnalytics(vendorId);
  }

  @Get('buyer/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My buyer analytics' })
  getMyAnalytics(@CurrentUser('id') userId: string) {
    return this.analyticsService.getBuyerAnalytics(userId);
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Recent platform activity' })
  getRecentActivity(@Query('limit') limit?: string) {
    return this.analyticsService.getRecentActivity(limit ? parseInt(limit, 10) : 20);
  }
}
