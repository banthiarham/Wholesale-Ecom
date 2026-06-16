import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BulkOrdersService } from './bulk-orders.service';
import { UpdateBulkOrderStatusDto } from './dto/update-bulk-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, BulkOrderStatus } from '@prisma/client';

@ApiTags('Bulk Orders')
@Controller('bulk-orders')
export class BulkOrdersController {
  constructor(private bulkOrdersService: BulkOrdersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's bulk orders" })
  @ApiResponse({ status: 200, description: 'Bulk orders retrieved' })
  async findMine(@CurrentUser() user: any) {
    const bulkOrders = await this.bulkOrdersService.findByUserId(user.id);
    return { bulkOrders };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all bulk orders (Admin)' })
  @ApiQuery({ name: 'status', enum: BulkOrderStatus, required: false })
  @ApiResponse({ status: 200, description: 'Bulk orders retrieved' })
  async findAll(@Query('status') status?: BulkOrderStatus) {
    const bulkOrders = await this.bulkOrdersService.findAll(status);
    return { bulkOrders };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bulk order details (Admin)' })
  @ApiParam({ name: 'id', description: 'Bulk order UUID' })
  @ApiResponse({ status: 200, description: 'Bulk order found' })
  @ApiResponse({ status: 404, description: 'Bulk order not found' })
  async findById(@Param('id') id: string) {
    const bulkOrder = await this.bulkOrdersService.findById(id);
    return { bulkOrder };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update bulk order status (Admin)' })
  @ApiParam({ name: 'id', description: 'Bulk order UUID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateBulkOrderStatusDto,
  ) {
    const bulkOrder = await this.bulkOrdersService.updateStatus(id, body.status);
    return { bulkOrder };
  }

  @Put(':id/convert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Convert a draft bulk order to a regular order (Admin)' })
  @ApiParam({ name: 'id', description: 'Bulk order UUID' })
  @ApiResponse({ status: 200, description: 'Bulk order converted to order' })
  async convertToOrder(@Param('id') id: string) {
    const result = await this.bulkOrdersService.convertToOrder(id);
    return result;
  }
}