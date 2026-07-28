import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Refunds')
@Controller('payments')
export class RefundsController {
  constructor(private refundsService: RefundsService) {}

  @Post(':orderId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a full or partial refund for an order\'s payment (admin)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiBody({ type: CreateRefundDto })
  async createRefund(
    @Param('orderId') orderId: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: any,
  ) {
    const refund = await this.refundsService.createRefund(orderId, dto, user.id);
    return { refund };
  }

  @Get(':orderId/refunds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List refund history for an order's payment (admin)" })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  async listRefunds(@Param('orderId') orderId: string) {
    const refunds = await this.refundsService.listRefunds(orderId);
    return { refunds };
  }
}
