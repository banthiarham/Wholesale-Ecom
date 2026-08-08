import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class RoleRequestsService {
  private readonly logger = new Logger(RoleRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateRoleRequestDto) {
    // Verify role exists
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException(`Role "${dto.roleId}" not found`);

    // Check if user already has a pending request for this role
    const existing = await this.prisma.roleChangeRequest.findFirst({
      where: { userId, roleId: dto.roleId, status: 'PENDING' },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending request for this role');
    }

    const request = await this.prisma.roleChangeRequest.create({
      data: {
        userId,
        roleId: dto.roleId,
        reason: dto.reason,
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });

    await this.notifyAdmins(
      'New role change request',
      `${request.user.firstName} ${request.user.lastName} requested the "${request.role.label}" role.`,
      { requestId: request.id, userId, roleId: dto.roleId },
    );

    return request;
  }

  private async notifyAdmins(title: string, message: string, data?: any) {
    const admins = await this.prisma.user.findMany({
      where: { OR: [{ role: 'ADMIN' }, { roleRel: { name: 'ADMIN' } }] },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.notificationsService
          .createNotification(admin.id, 'SYSTEM', title, message, data)
          .catch((err) => this.logger.error(`Failed to notify admin ${admin.id}: ${err.message}`)),
      ),
    );
  }

  async findAll(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.roleChangeRequest.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.roleChangeRequest.findMany({
      where: { userId },
      include: {
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const request = await this.prisma.roleChangeRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        role: { select: { id: true, name: true, label: true, color: true, icon: true } },
      },
    });
    if (!request) throw new NotFoundException(`Role change request "${id}" not found`);
    return request;
  }

  async approve(id: string, reviewedBy: string) {
    const request = await this.prisma.roleChangeRequest.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!request) throw new NotFoundException(`Role change request "${id}" not found`);
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // Update the request
    const updated = await this.prisma.roleChangeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    // Update the user's role. Only the roleId FK is touched — role-based pricing and
    // permissions already resolve dynamically off roleId/roleRel, so this is all that's
    // needed for the new pricing tier to take effect immediately.
    await this.prisma.user.update({
      where: { id: request.userId },
      data: { roleId: request.roleId },
    });

    await this.notificationsService
      .createNotification(
        request.userId,
        'SYSTEM',
        'Role change approved',
        `Your request to become "${request.role.label}" has been approved.`,
        { requestId: request.id, roleId: request.roleId },
      )
      .catch((err) => this.logger.error(`Failed to notify user ${request.userId} of approval: ${err.message}`));

    return this.findById(id);
  }

  async reject(id: string, reviewedBy: string) {
    const request = await this.prisma.roleChangeRequest.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!request) throw new NotFoundException(`Role change request "${id}" not found`);
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updated = await this.prisma.roleChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    await this.notificationsService
      .createNotification(
        request.userId,
        'SYSTEM',
        'Role change rejected',
        `Your request to become "${request.role.label}" was not approved.`,
        { requestId: request.id, roleId: request.roleId },
      )
      .catch((err) => this.logger.error(`Failed to notify user ${request.userId} of rejection: ${err.message}`));

    return this.findById(id);
  }

  /**
   * Admin resolves a pending request by granting a role other than the one requested
   * (e.g. requested Vendor, admin grants Distributor instead). Reuses UsersService.assignRole
   * so the same dual-write (roleId + legacy role enum) and permission-resolution logic that
   * powers Admin > Users role changes applies here too — no separate role-assignment path.
   */
  async changeRole(id: string, roleId: string, reviewedBy: string) {
    const request = await this.prisma.roleChangeRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Role change request "${id}" not found`);
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be resolved');
    }

    const newRole = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!newRole) throw new NotFoundException(`Role "${roleId}" not found`);

    // Grants the chosen role immediately (dual-write handled inside assignRole).
    await this.usersService.assignRole(request.userId, roleId);

    // Record which role was actually granted, in case it differs from what was requested.
    await this.prisma.roleChangeRequest.update({
      where: { id },
      data: {
        roleId,
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    await this.notificationsService
      .createNotification(
        request.userId,
        'SYSTEM',
        'Your role has been updated',
        `An admin has changed your account role to "${newRole.label}".`,
        { requestId: request.id, roleId },
      )
      .catch((err) => this.logger.error(`Failed to notify user ${request.userId} of role change: ${err.message}`));

    return this.findById(id);
  }
}