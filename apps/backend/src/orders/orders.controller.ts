import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CsvOrderParserService } from './csv-order-parser.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, OrderStatus, DeliveryStatus } from '@prisma/client';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private csvParser: CsvOrderParserService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place an order from the current cart' })
  @ApiResponse({ status: 201, description: 'Order placed successfully' })
  @ApiResponse({ status: 400, description: 'Cart is empty' })
  @ApiBody({ type: CreateOrderDto })
  async create(
    @Body() body: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    const order = await this.ordersService.createFromCart(
      user.userId,
      body.cartId,
      {
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress,
        notes: body.notes,
        couponCode: body.couponCode,
      },
    );
    return { order };
  }

  @Post('bulk-csv')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk order upload via CSV (sku, quantity, notes)' })
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
  async bulkCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { shippingAddress: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    const shippingAddress = JSON.parse(body.shippingAddress || '{}');
    const result = await this.csvParser.parseAndCreateOrder(
      user.userId,
      file.buffer,
      shippingAddress,
      body.notes,
    );
    return result;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List orders (Admins see all, users see their own)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  async findAll(@CurrentUser() user: any, @Query('status') status?: OrderStatus) {
    const isAdmin = user.role === UserRole.ADMIN;
    const orders = await this.ordersService.findAll(
      isAdmin ? undefined : user.userId,
      status,
    );
    return { orders };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === UserRole.ADMIN;
    const order = await this.ordersService.findById(
      id,
      isAdmin ? undefined : user.userId,
    );
    return { order };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status (Admin / Vendor)' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    const order = await this.ordersService.updateStatus(id, status);
    return { order };
  }

  @Put(':id/tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order tracking info (Admin / Vendor)' })
  @ApiResponse({ status: 200, description: 'Tracking info updated' })
  async updateTracking(
    @Param('id') id: string,
    @Body() body: UpdateTrackingDto,
  ) {
    const order = await this.ordersService.updateTracking(id, body);
    return { order };
  }

  @Get(':id/delivery-tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get delivery tracking for an order (Admin)' })
  async getDeliveryTracking(@Param('id') id: string) {
    return this.ordersService.getDeliveryTracking(id);
  }

  @Post(':id/delivery-tracking/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add delivery tracking event (Admin / Vendor)' })
  async addTrackingEvent(@Param('id') id: string, @Body() body: CreateTrackingEventDto) {
    return this.ordersService.addTrackingEvent(id, body);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an order (owner only)' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel delivered/cancelled order' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const order = await this.ordersService.cancelOrder(id, user.userId);
    return { order };
  }
}
