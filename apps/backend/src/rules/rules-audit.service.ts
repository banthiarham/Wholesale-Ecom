import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesAuditService {
  constructor(private prisma: PrismaService) {}

  async logChange(params: {
    entityType: string;
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE';
    userId?: string;
    userEmail?: string;
    changes?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        changes: params.changes ?? undefined,
      },
    });
  }

  async getHistory(entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}