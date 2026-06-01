import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';

@Injectable()
export class RoleRequestsService {
  constructor(private prisma: PrismaService) {}

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
    return request;
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
    const request = await this.prisma.roleChangeRequest.findUnique({ where: { id } });
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

    // Update the user's role
    await this.prisma.user.update({
      where: { id: request.userId },
      data: { roleId: request.roleId },
    });

    return this.findById(id);
  }

  async reject(id: string, reviewedBy: string) {
    const request = await this.prisma.roleChangeRequest.findUnique({ where: { id } });
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

    return this.findById(id);
  }
}