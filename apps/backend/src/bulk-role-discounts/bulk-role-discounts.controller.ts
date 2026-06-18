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
import { BulkRoleDiscountsService } from './bulk-role-discounts.service';
import { CreateBulkRoleDiscountDto } from './dto/create-bulk-role-discount.dto';
import { UpdateBulkRoleDiscountDto } from './dto/update-bulk-role-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Pricing — Bulk Role Discounts')
@Controller('pricing/bulk-role-discounts')
export class BulkRoleDiscountsController {
  constructor(private service: BulkRoleDiscountsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all bulk role discounts (Admin only)' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  async findAll(@Query('isActive') isActive?: string) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const discounts = await this.service.findAll(isActiveBool);
    return { bulkRoleDiscounts: discounts, count: discounts.length };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bulk role discount by ID' })
  @ApiResponse({ status: 200, description: 'Bulk role discount found' })
  @ApiResponse({ status: 404, description: 'Bulk role discount not found' })
  async findById(@Param('id') id: string) {
    const discount = await this.service.findById(id);
    return { bulkRoleDiscount: discount };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a bulk role discount (Admin only)' })
  @ApiResponse({ status: 201, description: 'Bulk role discount created' })
  async create(@Body() dto: CreateBulkRoleDiscountDto) {
    const discount = await this.service.create(dto);
    return { bulkRoleDiscount: discount };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a bulk role discount (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bulk role discount updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateBulkRoleDiscountDto) {
    const discount = await this.service.update(id, dto);
    return { bulkRoleDiscount: discount };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a bulk role discount (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bulk role discount deleted' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}