import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, ReturnStatus } from '@prisma/client';

@ApiTags('Returns')
@Controller('returns')
export class ReturnsController {
  constructor(private returnsService: ReturnsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a return request' })
  async create(
    @CurrentUser() user: any,
    @Body() body: { orderId: string; reason: string; notes?: string; items: { orderItemId: string; quantity: number; reason?: string }[] },
  ) {
    const ret = await this.returnsService.create(user.userId, body);
    return { return: ret };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List user's returns (admin sees all)" })
  async findAll(@CurrentUser() user: any) {
    const returns = await this.returnsService.findAll(user.userId, user.role);
    return { returns };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get return request details' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const ret = await this.returnsService.findById(id, user.userId, user.role);
    return { return: ret };
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update return status (Admin/Vendor)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ReturnStatus; refundAmount?: number },
  ) {
    const ret = await this.returnsService.updateStatus(id, body.status, body.refundAmount);
    return { return: ret };
  }
}