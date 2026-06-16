import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { CreditWalletDto, DebitWalletDto } from './dto/wallet-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Wallets')
@Controller('wallets')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's wallet with transactions" })
  @ApiResponse({ status: 200, description: 'Wallet found' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async findMyWallet(@CurrentUser() user: any) {
    const wallet = await this.walletService.findByUserId(user.id);
    return { wallet };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all wallets (Admin)' })
  @ApiResponse({ status: 200, description: 'Wallets retrieved' })
  async findAll() {
    const wallets = await this.walletService.findAll();
    return { wallets };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wallet details with recent transactions (Admin)' })
  @ApiParam({ name: 'id', description: 'Wallet UUID' })
  @ApiResponse({ status: 200, description: 'Wallet found' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async findById(@Param('id') id: string) {
    const wallet = await this.walletService.findById(id);
    return { wallet };
  }

  @Get(':id/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wallet transaction history (Admin)' })
  @ApiParam({ name: 'id', description: 'Wallet UUID' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved' })
  async getTransactions(@Param('id') id: string) {
    const transactions = await this.walletService.getTransactions(id);
    return { transactions };
  }

  @Post('credit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Credit (top-up) a wallet (Admin)' })
  @ApiResponse({ status: 200, description: 'Wallet credited' })
  async credit(@Body() body: CreditWalletDto) {
    const result = await this.walletService.credit(body.walletId, body.amount, body.description);
    return result;
  }

  @Post('debit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Debit (deduct) from a wallet (Admin)' })
  @ApiResponse({ status: 200, description: 'Wallet debited' })
  async debit(@Body() body: DebitWalletDto) {
    const result = await this.walletService.debit(body.walletId, body.amount, body.description, body.referenceId);
    return result;
  }
}