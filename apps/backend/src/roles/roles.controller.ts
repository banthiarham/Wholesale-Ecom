import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Roles & Permissions')
@Controller('roles')
export class RolesController {
  constructor(private service: RolesService) {}

  @Get('public')
  @ApiOperation({ summary: 'List selectable roles for registration (public, no auth)' })
  async findPublicRoles() {
    const roles = await this.service.findAll();
    // Filter out ADMIN — it should never be self-assigned at registration
    const selectable = roles
      .filter((r: any) => r.name !== 'ADMIN')
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        label: r.label,
        description: r.description,
        color: r.color,
        icon: r.icon,
        isSystem: r.isSystem,
      }));
    return { roles: selectable };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all roles (Admin only)' })
  @ApiResponse({ status: 200, description: 'Roles retrieved' })
  async findAll() {
    const roles = await this.service.findAll();
    return { roles, count: roles.length };
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all permissions (Admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved' })
  async findAllPermissions() {
    const permissions = await this.service.findAllPermissions();
    return { permissions, count: permissions.length };
  }

  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved' })
  async getMyPermissions(@Request() req: any) {
    const permissions = await this.service.getPermissionsForUser(req.user.id);
    return { permissions };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get role by ID with permissions (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role found' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new role (Admin only)' })
  @ApiResponse({ status: 201, description: 'Role created' })
  async create(@Body() dto: CreateRoleDto) {
    const role = await this.service.create(dto);
    return { role };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a role (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.service.update(id, dto);
    return { role };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a role (Admin only, system roles cannot be deleted)' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put(':id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set permissions for a role (Admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions updated' })
  async setPermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto) {
    const role = await this.service.setPermissions(id, dto);
    return { role };
  }

  // ---- Permission CRUD ----

  @Post('permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a permission (Admin only)' })
  @ApiResponse({ status: 201, description: 'Permission created' })
  async createPermission(@Body() dto: CreatePermissionDto) {
    const permission = await this.service.createPermission(dto);
    return { permission };
  }

  @Delete('permissions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a permission (Admin only)' })
  @ApiResponse({ status: 200, description: 'Permission deleted' })
  async deletePermission(@Param('id') id: string) {
    return this.service.deletePermission(id);
  }
}