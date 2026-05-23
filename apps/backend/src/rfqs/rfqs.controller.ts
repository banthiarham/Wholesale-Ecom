import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { RfqsService } from './rfqs.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { UpdateRfqDto } from './dto/update-rfq.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('RFQs')
@Controller('rfqs')
export class RfqsController {
  constructor(private rfqsService: RfqsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new RFQ' })
  @ApiBody({ type: CreateRfqDto })
  @ApiResponse({ status: 201, description: 'RFQ created' })
  async create(@Body() dto: CreateRfqDto, @CurrentUser('id') userId: string) {
    return this.rfqsService.createRfq(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List RFQs (buyer sees own; vendor sees open; admin sees all)' })
  async findAll(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.rfqsService.findAll(userId, role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get RFQ detail with items and quotes' })
  @ApiParam({ name: 'id', description: 'RFQ UUID' })
  async findById(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.rfqsService.findById(id, userId, role);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update draft RFQ' })
  @ApiParam({ name: 'id', description: 'RFQ UUID' })
  @ApiBody({ type: UpdateRfqDto })
  async update(@Param('id') id: string, @Body() dto: UpdateRfqDto, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.rfqsService.updateRfq(id, dto, userId, role);
  }

  @Put(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit draft RFQ for vendor review' })
  @ApiParam({ name: 'id', description: 'RFQ UUID' })
  async submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.rfqsService.submitRfq(id, userId, role);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an RFQ' })
  @ApiParam({ name: 'id', description: 'RFQ UUID' })
  async cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.rfqsService.cancelRfq(id, userId, role);
  }
}
