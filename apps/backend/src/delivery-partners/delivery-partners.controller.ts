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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DeliveryPartnersService } from './delivery-partners.service';
import { CreateDeliveryPartnerDto } from './dto/create-delivery-partner.dto';
import { UpdateDeliveryPartnerDto } from './dto/update-delivery-partner.dto';

@ApiTags('Delivery Partners')
@Controller('delivery-partners')
export class DeliveryPartnersController {
  constructor(private service: DeliveryPartnersService) {}

  @Get()
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiOperation({ summary: 'List delivery partners (active by default)' })
  async findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly === 'true' || activeOnly === undefined;
    return this.service.findAll(active);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all delivery partners including inactive (Admin)' })
  async findAllAdmin() {
    return this.service.findAll(false);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delivery partner stats (Admin)' })
  async getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery partner by ID' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create delivery partner (Admin)' })
  async create(@Body() dto: CreateDeliveryPartnerDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update delivery partner (Admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateDeliveryPartnerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete delivery partner (Admin, soft-delete if in use)' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}