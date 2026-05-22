import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, OrderStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() body: { cartId: string; shippingAddress: any; billingAddress?: any; notes?: string },
    @CurrentUser() user: any,
  ) {
    const order = await this.ordersService.createFromCart(
      user.userId,
      body.cartId,
      {
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress,
        notes: body.notes,
      },
    );
    return { order };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
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
  async updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    const order = await this.ordersService.updateStatus(id, status);
    return { order };
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const order = await this.ordersService.cancelOrder(id, user.userId);
    return { order };
  }
}
