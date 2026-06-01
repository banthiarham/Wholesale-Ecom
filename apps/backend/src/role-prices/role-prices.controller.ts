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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolePricesService } from './role-prices.service';
import { CreateRolePriceDto } from './dto/create-role-price.dto';
import { UpdateRolePriceDto } from './dto/update-role-price.dto';
import { BulkRolePriceDto } from './dto/bulk-role-price.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Pricing — Role Prices')
@Controller('pricing/role-prices')
export class RolePricesController {
  constructor(private service: RolePricesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List role prices (Admin only)' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product' })
  @ApiQuery({ name: 'roleId', required: false, description: 'Filter by role' })
  async findAll(
    @Query('productId') productId?: string,
    @Query('roleId') roleId?: string,
  ) {
    const rolePrices = await this.service.findAll(productId, roleId);
    return { rolePrices, count: rolePrices.length };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get role price by ID' })
  @ApiResponse({ status: 200, description: 'Role price found' })
  @ApiResponse({ status: 404, description: 'Role price not found' })
  async findById(@Param('id') id: string) {
    const rolePrice = await this.service.findById(id);
    return { rolePrice };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a role price (Admin only)' })
  @ApiResponse({ status: 201, description: 'Role price created' })
  async create(@Body() dto: CreateRolePriceDto) {
    const rolePrice = await this.service.create(dto);
    return { rolePrice };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a role price (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role price updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateRolePriceDto) {
    const rolePrice = await this.service.update(id, dto);
    return { rolePrice };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a role price (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role price deleted' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk create/update role prices for a product (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role prices bulk updated' })
  async bulkSet(@Body() dto: BulkRolePriceDto) {
    const results = await this.service.bulkSet(dto);
    return { rolePrices: results, count: results.length };
  }
}