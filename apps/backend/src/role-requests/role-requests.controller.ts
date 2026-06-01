import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RoleRequestsService } from './role-requests.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Role Change Requests')
@Controller('role-requests')
export class RoleRequestsController {
  constructor(private service: RoleRequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a role change request (any authenticated user)' })
  @ApiResponse({ status: 201, description: 'Request submitted' })
  async create(@Request() req: any, @Body() dto: CreateRoleRequestDto) {
    const request = await this.service.create(req.user.id, dto);
    return { request };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all role change requests (Admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  async findAll(@Query('status') status?: string) {
    const requests = await this.service.findAll(status);
    return { requests, count: requests.length };
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user role change requests' })
  async findMine(@Request() req: any) {
    const requests = await this.service.findByUser(req.user.id);
    return { requests, count: requests.length };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get role change request by ID (Admin only)' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a role change request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Request approved, user role updated' })
  async approve(@Param('id') id: string, @Request() req: any) {
    const request = await this.service.approve(id, req.user.id);
    return { request };
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a role change request (Admin only)' })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  async reject(@Param('id') id: string, @Request() req: any) {
    const request = await this.service.reject(id, req.user.id);
    return { request };
  }
}