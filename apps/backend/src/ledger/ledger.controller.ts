import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { LedgerService, LedgerSource } from './ledger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

const VALID_SOURCES: LedgerSource[] = ['ORDER', 'PAYMENT', 'RETURN', 'REFUND', 'WALLET'];

function parseFilters(from?: string, to?: string, sources?: string) {
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    sources: sources
      ? (sources.split(',').map((s) => s.trim().toUpperCase()).filter((s): s is LedgerSource => VALID_SOURCES.includes(s as LedgerSource)))
      : undefined,
  };
}

@ApiTags('Ledger')
@Controller('ledger')
export class LedgerController {
  constructor(private ledgerService: LedgerService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current user's ledger (buyer/vendor/distributor)" })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'sources', required: false, description: 'Comma-separated: ORDER,PAYMENT,RETURN,REFUND,WALLET' })
  async getMyLedger(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sources') sources?: string,
  ) {
    return this.ledgerService.getLedger(user.id, parseFilters(from, to, sources));
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a specific user's ledger (Admin only, for support/lookup)" })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'sources', required: false, description: 'Comma-separated: ORDER,PAYMENT,RETURN,REFUND,WALLET' })
  async getUserLedger(
    @Param('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sources') sources?: string,
  ) {
    return this.ledgerService.getLedger(userId, parseFilters(from, to, sources));
  }
}
