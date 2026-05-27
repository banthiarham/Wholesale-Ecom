import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PaymentGatewaysService } from './payment-gateways.service';
import { CreateGatewayDto } from './dto/create-gateway.dto';
import { UpdateGatewayDto } from './dto/update-gateway.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Payment Gateways')
@Controller('payment-gateways')
export class PaymentGatewaysController {
  constructor(private service: PaymentGatewaysService) {}

  @Get('enabled')
  @ApiOperation({ summary: 'Get enabled payment gateways (public, for checkout)' })
  async getEnabledGateways() {
    const gateways = await this.service.getEnabledGateways();
    return { gateways };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all payment gateways (admin)' })
  async findAll() {
    const gateways = await this.service.findAll();
    return { gateways };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment gateway by ID (admin)' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id') id: string) {
    const gateway = await this.service.findOne(id);
    return { gateway };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment gateway configuration (admin)' })
  async create(@Body() dto: CreateGatewayDto) {
    const gateway = await this.service.create(dto);
    return { gateway };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a payment gateway configuration (admin)' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Body() dto: UpdateGatewayDto) {
    const gateway = await this.service.update(id, dto);
    return { gateway };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a payment gateway configuration (admin)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string) {
    const gateway = await this.service.remove(id);
    return { gateway };
  }
}