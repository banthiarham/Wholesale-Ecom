import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { RulesAuditService } from './rules-audit.service';
import { validateRuleConditionsActions } from './dto/rule-validation';

@Injectable()
export class RulesService {
  constructor(
    private prisma: PrismaService,
    private auditService: RulesAuditService,
  ) {}

  async findAll(type?: string, isActive?: boolean) {
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    const rules = await this.prisma.dynamicRule.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    return rules;
  }

  async findById(id: string) {
    const rule = await this.prisma.dynamicRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Rule ${id} not found`);
    return rule;
  }

  async create(dto: CreateRuleDto, userId?: string, userEmail?: string) {
    // Validate conditions/actions against the rule type
    await validateRuleConditionsActions(dto.type, dto.conditions, dto.actions);

    const data: any = {
      name: dto.name,
      type: dto.type,
      description: dto.description,
      priority: dto.priority ?? 0,
      isActive: dto.isActive ?? true,
      conditions: dto.conditions,
      actions: dto.actions,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      createdBy: userId || null,
    };
    const rule = await this.prisma.dynamicRule.create({ data });

    // Create audit log
    await this.auditService.logChange({
      entityType: 'DynamicRule',
      entityId: rule.id,
      action: 'CREATE',
      userId,
      userEmail,
      changes: { name: rule.name, type: rule.type, priority: rule.priority, isActive: rule.isActive },
    });

    return rule;
  }

  async update(id: string, dto: UpdateRuleDto, userId?: string, userEmail?: string) {
    const existing = await this.findById(id);

    // Validate conditions/actions if type is provided or if conditions/actions are being updated
    const effectiveType = dto.type || existing.type;
    const effectiveConditions = dto.conditions !== undefined ? dto.conditions : existing.conditions;
    const effectiveActions = dto.actions !== undefined ? dto.actions : existing.actions;
    await validateRuleConditionsActions(effectiveType as any, effectiveConditions, effectiveActions);

    const data: any = { updatedBy: userId || null };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.conditions !== undefined) data.conditions = dto.conditions;
    if (dto.actions !== undefined) data.actions = dto.actions;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;

    const rule = await this.prisma.dynamicRule.update({ where: { id }, data });

    // Compute diff for audit log
    const changes: Record<string, any> = {};
    for (const key of Object.keys(dto as any)) {
      if ((dto as any)[key] !== undefined) {
        const oldVal = (existing as any)[key];
        const newVal = (rule as any)[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes[key] = { from: oldVal, to: newVal };
        }
      }
    }

    await this.auditService.logChange({
      entityType: 'DynamicRule',
      entityId: id,
      action: 'UPDATE',
      userId,
      userEmail,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    });

    return rule;
  }

  async remove(id: string, userId?: string, userEmail?: string) {
    const existing = await this.findById(id);

    // Create audit log before deletion
    await this.auditService.logChange({
      entityType: 'DynamicRule',
      entityId: id,
      action: 'DELETE',
      userId,
      userEmail,
      changes: { name: existing.name, type: existing.type },
    });

    await this.prisma.dynamicRule.delete({ where: { id } });
    return { success: true };
  }

  async toggleActive(id: string, userId?: string, userEmail?: string) {
    const rule = await this.findById(id);
    const updated = await this.prisma.dynamicRule.update({
      where: { id },
      data: { isActive: !rule.isActive, updatedBy: userId || null },
    });

    await this.auditService.logChange({
      entityType: 'DynamicRule',
      entityId: id,
      action: 'TOGGLE',
      userId,
      userEmail,
      changes: { isActive: { from: rule.isActive, to: updated.isActive } },
    });

    return updated;
  }
}