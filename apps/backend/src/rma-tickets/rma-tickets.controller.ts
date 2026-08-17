import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RmaTicketPriority, RmaTicketStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RmaTicketsService } from './rma-tickets.service';

@ApiTags('RMA Tickets')
@Controller('rma-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.VENDOR)
@ApiBearerAuth()
export class RmaTicketsController {
  constructor(private service: RmaTicketsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get RMA ticket dashboard KPIs' })
  getKpis() {
    return this.service.getKpis();
  }

  @Get('return/:returnRequestId')
  @ApiOperation({ summary: 'Get RMA ticket and activity for a return/replacement' })
  findByReturnRequest(@Param('returnRequestId') returnRequestId: string) {
    return this.service.findByReturnRequest(returnRequestId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update RMA ticket status, priority, or assignment' })
  update(
    @Param('id') id: string,
    @Body() body: { status?: RmaTicketStatus; priority?: RmaTicketPriority; assignedToId?: string | null; note?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(id, body, userId);
  }
}
