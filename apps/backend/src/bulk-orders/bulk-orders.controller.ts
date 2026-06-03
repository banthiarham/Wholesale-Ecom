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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { BulkOrdersService } from './bulk-orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateBulkOrderItemDto } from './dto/update-bulk-order-item.dto';
import { QuickOrderDto } from './dto/quick-order.dto';
import { BulkOrderStatus } from '@prisma/client';

@ApiTags('Bulk Orders')
@Controller('bulk-orders')
export class BulkOrdersController {
  constructor(private bulkOrdersService: BulkOrdersService) {}

  @Post('quick-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quick order: place order by SKU + quantity (no draft)' })
  async quickOrder(@Body() body: QuickOrderDto, @CurrentUser() user: any) {
    const result = await this.bulkOrdersService.quickOrder(
      user.id,
      body.items,
      { shippingAddress: body.shippingAddress, notes: body.notes },
    );
    return result;
  }

  @Post('upload-excel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Excel file to create a draft bulk order' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        shippingAddress: { type: 'object' },
        notes: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { shippingAddress: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    const shippingAddress = JSON.parse(body.shippingAddress || '{}');
    const result = await this.bulkOrdersService.createDraftFromExcel(
      user.id,
      file.buffer,
      shippingAddress,
      body.notes,
    );
    return result;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List bulk orders (Buyer sees own, Admin sees all)' })
  @ApiQuery({ name: 'status', enum: BulkOrderStatus, required: false })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: BulkOrderStatus,
  ) {
    const effectiveRole = user.effectiveRole || user.role;
    const bulkOrders = await this.bulkOrdersService.findAll(user.id, effectiveRole, status);
    return { bulkOrders };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bulk order details by ID' })
  @ApiParam({ name: 'id', description: 'Bulk Order UUID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const effectiveRole = user.effectiveRole || user.role;
    const bulkOrder = await this.bulkOrdersService.findById(id, user.id, effectiveRole);
    return { bulkOrder };
  }

  @Put(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update quantity of a bulk order item (owner only)' })
  @ApiParam({ name: 'id', description: 'Bulk Order UUID' })
  @ApiParam({ name: 'itemId', description: 'Bulk Order Item UUID' })
  async updateItemQuantity(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateBulkOrderItemDto,
    @CurrentUser() user: any,
  ) {
    const item = await this.bulkOrdersService.updateItemQuantity(id, itemId, body.quantity, user.id);
    return { item };
  }

  @Post(':id/place')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Convert a DRAFT bulk order into a real Order' })
  @ApiParam({ name: 'id', description: 'Bulk Order UUID' })
  async placeOrder(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.bulkOrdersService.placeOrder(id, user.id);
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a DRAFT bulk order (owner only)' })
  @ApiParam({ name: 'id', description: 'Bulk Order UUID' })
  async cancelDraft(@Param('id') id: string, @CurrentUser() user: any) {
    const bulkOrder = await this.bulkOrdersService.cancelDraft(id, user.id);
    return { bulkOrder };
  }
}