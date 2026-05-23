import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { SeasonalDiscountsService } from './seasonal-discounts.service';
import { CreateSeasonalDiscountDto } from './dto/create-seasonal-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Pricing — Seasonal Discounts')
@Controller('pricing/seasonal-discounts')
export class SeasonalDiscountsController {
  constructor(private service: SeasonalDiscountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all seasonal discounts' })
  @ApiResponse({ status: 200, description: 'Discounts retrieved' })
  async findAll() {
    const discounts = await this.service.findAll();
    return { discounts, count: discounts.length };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get seasonal discount by ID' })
  @ApiResponse({ status: 200, description: 'Discount found' })
  @ApiResponse({ status: 404, description: 'Discount not found' })
  @ApiParam({ name: 'id', description: 'Discount UUID' })
  async findById(@Param('id') id: string) {
    const discount = await this.service.findById(id);
    return { discount };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a seasonal discount (Admin only)' })
  @ApiResponse({ status: 201, description: 'Discount created' })
  @ApiBody({ type: CreateSeasonalDiscountDto })
  async create(@Body() dto: CreateSeasonalDiscountDto) {
    const discount = await this.service.create(dto);
    return { discount };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a seasonal discount (Admin only)' })
  @ApiResponse({ status: 200, description: 'Discount updated' })
  @ApiParam({ name: 'id', description: 'Discount UUID' })
  @ApiBody({ type: CreateSeasonalDiscountDto })
  async update(@Param('id') id: string, @Body() dto: CreateSeasonalDiscountDto) {
    const discount = await this.service.update(id, dto);
    return { discount };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a seasonal discount (Admin only)' })
  @ApiResponse({ status: 200, description: 'Discount deleted' })
  @ApiParam({ name: 'id', description: 'Discount UUID' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
