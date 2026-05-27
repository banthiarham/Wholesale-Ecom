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
import { DeliveryPartnerFactory } from './providers/partner.factory';
import { CreateDeliveryPartnerDto } from './dto/create-delivery-partner.dto';
import { UpdateDeliveryPartnerDto } from './dto/update-delivery-partner.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { SyncTrackingDto } from './dto/sync-tracking.dto';
import { ServiceabilityQueryDto } from './dto/serviceability-query.dto';

@ApiTags('Delivery Partners')
@Controller('delivery-partners')
export class DeliveryPartnersController {
  constructor(
    private service: DeliveryPartnersService,
    private factory: DeliveryPartnerFactory,
  ) {}

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

  @Get('credential-fields/:code')
  @ApiOperation({ summary: 'Get credential field definitions for a built-in provider' })
  async getCredentialFields(@Param('code') code: string) {
    const provider = this.factory.getProvider(code);
    const isBuiltin = this.factory.isBuiltinProvider(code);
    return {
      code,
      isBuiltin,
      credentialFields: provider.getCredentialFields(),
    };
  }

  @Post('sync-all-tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk sync tracking for all API-enabled orders (Admin)' })
  async syncAllTracking() {
    return this.service.syncAllTracking();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery partner by ID' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/serviceability')
  @ApiOperation({ summary: 'Check pincode serviceability' })
  async checkServiceability(
    @Param('id') id: string,
    @Query() query: ServiceabilityQueryDto,
  ) {
    return this.service.checkServiceability(id, query.originPincode, query.destinationPincode);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create delivery partner (Admin)' })
  async create(@Body() dto: CreateDeliveryPartnerDto) {
    return this.service.create(dto);
  }

  @Post(':id/test-connection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test API connectivity for a delivery partner (Admin)' })
  async testConnection(@Param('id') id: string) {
    return this.service.testConnection(id);
  }

  @Post(':id/create-shipment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create shipment via partner API (Admin)' })
  async createShipment(@Param('id') id: string, @Body() dto: CreateShipmentDto) {
    return this.service.createShipment(id, dto.orderId);
  }

  @Post(':id/sync-tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync tracking for an order via partner API (Admin)' })
  async syncTracking(@Param('id') id: string, @Body() dto: SyncTrackingDto) {
    return this.service.syncTracking(id, dto.orderId);
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