import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { TopupDto } from './dto/topup.dto';
import { DeductDto } from './dto/deduct.dto';
import { AdjustDto } from './dto/adjust.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user wallet balance' })
  async getBalance(@CurrentUser('id') userId: string) {
    return this.walletService.getBalance(userId);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user wallet transactions' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.walletService.getTransactions(userId, limit ? Number(limit) : 50, offset ? Number(offset) : 0);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all wallets (Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.findAll(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('admin/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user wallet details (Admin only)' })
  async getWalletByUserId(@Param('userId') userId: string) {
    return this.walletService.getWalletByUserId(userId);
  }

  @Post('topup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Top up wallet (Admin only)' })
  async topup(@Body() dto: TopupDto, @CurrentUser('id') adminId: string) {
    const result = await this.walletService.topup(dto.userId, dto.amount, dto.description, dto.referenceId, adminId);
    return result;
  }

  @Post('deduct')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deduct from wallet (Admin only)' })
  async deduct(@Body() dto: DeductDto, @CurrentUser('id') adminId: string) {
    const result = await this.walletService.deduct(dto.userId, dto.amount, dto.description, dto.referenceId, adminId);
    return result;
  }

  @Post('adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust wallet balance (Admin only)' })
  async adjust(@Body() dto: AdjustDto, @CurrentUser('id') adminId: string) {
    const result = await this.walletService.adjust(dto.userId, dto.amount, dto.description, adminId);
    return result;
  }
}