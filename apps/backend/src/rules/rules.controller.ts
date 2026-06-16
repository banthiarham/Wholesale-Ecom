import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { RulesEngineService } from './rules-engine.service';
import { RulesAuditService } from './rules-audit.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Dynamic Rules')
@Controller('rules')
export class RulesController {
  constructor(
    private readonly rulesService: RulesService,
    private readonly rulesEngine: RulesEngineService,
    private readonly auditService: RulesAuditService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all dynamic rules (Admin only)' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiResponse({ status: 200, description: 'Rules retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only' })
  async findAll(
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === undefined ? undefined : isActive === 'true';
    const rules = await this.rulesService.findAll(type, active);
    return { rules, count: rules.length };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get rule by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async findById(@Param('id') id: string) {
    const rule = await this.rulesService.findById(id);
    return { rule };
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit history for a rule (Admin only)' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Audit history retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHistory(@Param('id') id: string) {
    const history = await this.auditService.getHistory(id);
    return { history };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a dynamic rule (Admin only)' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  @ApiResponse({ status: 400, description: 'Validation error in conditions/actions' })
  async create(@Body() dto: CreateRuleDto, @CurrentUser() user: any) {
    const rule = await this.rulesService.create(dto, user?.id, user?.email);
    return { rule };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a dynamic rule (Admin only)' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule updated' })
  @ApiResponse({ status: 400, description: 'Validation error in conditions/actions' })
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto, @CurrentUser() user: any) {
    const rule = await this.rulesService.update(id, dto, user?.id, user?.email);
    return { rule };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a dynamic rule (Admin only)' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rulesService.remove(id, user?.id, user?.email);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle rule active/inactive (Admin only)' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule toggled' })
  async toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    const rule = await this.rulesService.toggleActive(id, user?.id, user?.email);
    return { rule };
  }

  @Post('evaluate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Evaluate active rules for current cart context' })
  @ApiResponse({ status: 200, description: 'Rules evaluated' })
  async evaluate(
    @Body() context: Record<string, any>,
    @CurrentUser('id') userId?: string,
    @CurrentUser('effectiveRole') userRole?: string,
  ) {
    const ruleContext = {
      ...context,
      userId,
      userRole,
    };
    const result = await this.rulesEngine.evaluateRules(ruleContext);
    return { result };
  }
}