import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Quotes')
@Controller()
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Post('rfqs/:rfqId/quotes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a quote on an RFQ' })
  @ApiParam({ name: 'rfqId', description: 'RFQ UUID' })
  @ApiBody({ type: CreateQuoteDto })
  async create(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateQuoteDto,
    @CurrentUser('id') vendorId: string,
  ) {
    return this.quotesService.createQuote(rfqId, vendorId, dto);
  }

  @Get('rfqs/:rfqId/quotes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List quotes for an RFQ' })
  @ApiParam({ name: 'rfqId', description: 'RFQ UUID' })
  async findByRfq(
    @Param('rfqId') rfqId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.quotesService.findByRfq(rfqId, userId, role);
  }

  @Get('quotes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List quotes by vendor' })
  async findVendorQuotes(@CurrentUser('id') vendorId: string) {
    return this.quotesService.findVendorQuotes(vendorId);
  }

  @Put('quotes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update pending quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiBody({ type: UpdateQuoteDto })
  async update(@Param('id') id: string, @Body() dto: UpdateQuoteDto, @CurrentUser('id') vendorId: string) {
    return this.quotesService.updateQuote(id, dto, vendorId);
  }

  @Put('quotes/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a quote (buyer only)' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  async accept(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.quotesService.acceptQuote(id, userId);
  }

  @Put('quotes/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a quote (buyer only)' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  async reject(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.quotesService.rejectQuote(id, userId);
  }
}
