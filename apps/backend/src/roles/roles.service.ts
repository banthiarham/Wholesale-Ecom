import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: { select: { users: true, rolePermissions: true, rolePrices: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      isSystem: r.isSystem,
      color: r.color,
      icon: r.icon,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      userCount: r._count.users,
      permissionCount: r._count.rolePermissions,
      rolePriceCount: r._count.rolePrices,
    }));
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        users: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { rolePrices: true } },
      },
    });
    if (!role) throw new NotFoundException(`Role "${id}" not found`);
    return {
      id: role.id,
      name: role.name,
      label: role.label,
      description: role.description,
      isSystem: role.isSystem,
      color: role.color,
      icon: role.icon,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        action: rp.permission.action,
        resource: rp.permission.resource,
        description: rp.permission.description,
      })),
      users: role.users,
      rolePriceCount: role._count.rolePrices,
    };
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);
    return this.prisma.role.create({
      data: {
        name: dto.name,
        label: dto.label,
        description: dto.description,
        isSystem: dto.isSystem ?? false,
        color: dto.color,
        icon: dto.icon,
      },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role "${id}" not found`);
    if (role.isSystem && dto.label !== undefined && dto.label !== role.label) {
      throw new BadRequestException('System role labels cannot be changed');
    }
    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
      },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role "${id}" not found`);
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');

    // Reassign users to BUYER role before deleting
    const buyerRole = await this.prisma.role.findUnique({ where: { name: 'BUYER' } });
    if (buyerRole) {
      await this.prisma.user.updateMany({
        where: { roleId: id },
        data: { roleId: buyerRole.id },
      });
    }

    return this.prisma.role.delete({ where: { id } });
  }

  async setPermissions(roleId: string, dto: SetPermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`);

    // Validate all permission IDs exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });
    if (permissions.length !== dto.permissionIds.length) {
      const found = new Set(permissions.map((p) => p.id));
      const missing = dto.permissionIds.filter((pid) => !found.has(pid));
      throw new NotFoundException(`Permissions not found: ${missing.join(', ')}`);
    }

    // Delete existing and recreate
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: dto.permissionIds.map((permissionId) => ({ roleId, permissionId })),
    });

    return this.findById(roleId);
  }

  async getPermissionsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roleRel: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!user?.roleRel) return [];
    return user.roleRel.rolePermissions.map((rp) => ({
      id: rp.permission.id,
      action: rp.permission.action,
      resource: rp.permission.resource,
      description: rp.permission.description,
    }));
  }

  // ---- Permission CRUD ----

  async findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async createPermission(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { action_resource: { action: dto.action, resource: dto.resource } },
    });
    if (existing) throw new ConflictException(`Permission "${dto.action}:${dto.resource}" already exists`);
    return this.prisma.permission.create({ data: dto });
  }

  async deletePermission(id: string) {
    const perm = await this.prisma.permission.findUnique({ where: { id } });
    if (!perm) throw new NotFoundException(`Permission "${id}" not found`);
    return this.prisma.permission.delete({ where: { id } });
  }
}