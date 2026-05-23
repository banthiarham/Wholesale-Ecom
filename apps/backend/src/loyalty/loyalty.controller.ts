import { Controller, Get, Post, Body, UseGuards, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my loyalty account' })
  getMyAccount(@CurrentUser('id') userId: string) {
    return this.loyaltyService.getAccount(userId);
  }

  @Get('leaderboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get loyalty leaderboard' })
  getLeaderboard(@Query('limit') limit?: string) {
    return this.loyaltyService.getLeaderboard(limit ? parseInt(limit, 10) : 20);
  }

  @Post('earn')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually add points (admin)' })
  earnPoints(
    @Body() dto: { userId: string; points: number; description: string; amount?: number },
  ) {
    return this.loyaltyService.earnPoints(dto.userId, dto.points, dto.description, dto.amount);
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem points' })
  redeemPoints(
    @CurrentUser('id') userId: string,
    @Body() dto: { points: number; description: string },
  ) {
    return this.loyaltyService.redeemPoints(userId, dto.points, dto.description);
  }

  @Post('cashback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add cashback to wallet (admin)' })
  addCashback(
    @Body() dto: { userId: string; amount: number; description: string },
  ) {
    return this.loyaltyService.addCashback(dto.userId, dto.amount, dto.description);
  }
}
