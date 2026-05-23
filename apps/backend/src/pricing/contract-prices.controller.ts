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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ContractPricesService } from './contract-prices.service';
import { CreateContractPriceDto } from './dto/create-contract-price.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Pricing — Contract Prices')
@Controller('pricing/contract-prices')
export class ContractPricesController {
  constructor(private service: ContractPricesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List contract prices (Admin / Vendor)' })
  @ApiResponse({ status: 200, description: 'Contract prices retrieved' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product' })
  async findAll(
    @Query('userId') userId?: string,
    @Query('productId') productId?: string,
  ) {
    const contracts = await this.service.findAll(userId, productId);
    return { contracts, count: contracts.length };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get contract price by ID' })
  @ApiResponse({ status: 200, description: 'Contract found' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  async findById(@Param('id') id: string) {
    const contract = await this.service.findById(id);
    return { contract };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a contract price (Admin / Vendor)' })
  @ApiResponse({ status: 201, description: 'Contract created' })
  @ApiBody({ type: CreateContractPriceDto })
  async create(@Body() dto: CreateContractPriceDto) {
    const contract = await this.service.create(dto);
    return { contract };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a contract price (Admin / Vendor)' })
  @ApiResponse({ status: 200, description: 'Contract updated' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiBody({ type: CreateContractPriceDto })
  async update(@Param('id') id: string, @Body() dto: CreateContractPriceDto) {
    const contract = await this.service.update(id, dto);
    return { contract };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a contract price (Admin only)' })
  @ApiResponse({ status: 200, description: 'Contract deleted' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
