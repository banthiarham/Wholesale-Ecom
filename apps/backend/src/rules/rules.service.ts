import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

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

  async create(dto: CreateRuleDto) {
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
    };
    const rule = await this.prisma.dynamicRule.create({ data });
    return rule;
  }

  async update(id: string, dto: UpdateRuleDto) {
    await this.findById(id);
    const data: any = {};
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
    return rule;
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.dynamicRule.delete({ where: { id } });
    return { success: true };
  }

  async toggleActive(id: string) {
    const rule = await this.findById(id);
    const updated = await this.prisma.dynamicRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
    return updated;
  }
}