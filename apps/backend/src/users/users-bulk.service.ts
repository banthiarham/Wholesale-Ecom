import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toCsv, parseSheet, isClear } from '../common/bulk-csv';

const HEADERS = [
  'ID', 'Email', 'First Name', 'Last Name', 'Phone', 'Role', 'Status',
  'Company Name', 'Company Address', 'Tax ID', 'Organization Name', 'GSTIN', 'PAN Number', 'Contact Person',
  'City', 'State', 'Pincode', 'Created At', 'Last Login', 'Orders',
];

/** Editable text columns: header -> User field. An empty cell leaves the field alone, "-" clears it. */
const TEXT_FIELDS: [string, string][] = [
  ['Phone', 'phone'], ['Company Name', 'companyName'], ['Company Address', 'companyAddress'], ['Tax ID', 'taxId'],
  ['Organization Name', 'organizationName'], ['GSTIN', 'gstin'], ['PAN Number', 'panNumber'], ['Contact Person', 'contactPersonName'],
  ['City', 'city'], ['State', 'state'], ['Pincode', 'pincode'],
];

@Injectable()
export class UsersBulkService {
  constructor(private prisma: PrismaService) {}

  async exportCsv(filter: { role?: string; roleId?: string; status?: string }): Promise<Buffer> {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.roleId) where.roleId = filter.roleId;
    else if (filter.role) {
      // A role name: custom roles match through the role relation, built-in ones also through the legacy enum.
      where.OR = [{ roleRel: { is: { name: filter.role } } }, ...((Object.values(UserRole) as string[]).includes(filter.role) ? [{ role: filter.role as UserRole }] : [])];
    }
    const users = await this.prisma.user.findMany({
      where,
      include: { roleRel: { select: { name: true } }, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const rows = users.map((u: any) => ({
      ID: u.id,
      Email: u.email,
      'First Name': u.firstName,
      'Last Name': u.lastName,
      Phone: u.phone || '',
      Role: u.roleRel?.name || u.role,
      Status: u.status,
      'Company Name': u.companyName || '',
      'Company Address': u.companyAddress || '',
      'Tax ID': u.taxId || '',
      'Organization Name': u.organizationName || '',
      GSTIN: u.gstin || '',
      'PAN Number': u.panNumber || '',
      'Contact Person': u.contactPersonName || '',
      City: u.city || '',
      State: u.state || '',
      Pincode: u.pincode || '',
      'Created At': u.createdAt.toISOString(),
      'Last Login': u.lastLoginAt ? u.lastLoginAt.toISOString() : '',
      Orders: u._count.orders,
    }));
    return toCsv(HEADERS, rows);
  }

  /** Applies an edited export: rows are matched by ID (or Email). Passwords are never touched. */
  async importCsv(buffer: Buffer): Promise<{ updated: number; unchanged: number; errors: string[] }> {
    const sheet = await parseSheet(buffer);
    const roles = await this.prisma.role.findMany();
    const roleByKey = new Map<string, (typeof roles)[number]>();
    for (const r of roles) {
      roleByKey.set(r.name.toLowerCase(), r);
      roleByKey.set(r.label.toLowerCase(), r);
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let updated = 0;
    let unchanged = 0;
    const errors: string[] = [];

    for (const row of sheet.rows) {
      try {
        const id = row.get('ID') || '';
        const email = (row.get('Email') || '').toLowerCase();
        if (!id && !email) { errors.push(`Row ${row.rowNumber}: no ID or Email`); continue; }

        let user: any = id ? await this.prisma.user.findUnique({ where: { id }, include: { roleRel: { select: { name: true } } } }) : null;
        if (!user && email) user = await this.prisma.user.findUnique({ where: { email }, include: { roleRel: { select: { name: true } } } });
        if (!user) { errors.push(`Row ${row.rowNumber}: user not found (${id || email})`); continue; }

        const data: Record<string, any> = {};
        // Email can only be changed when the row is matched by ID.
        if (id && email && email !== user.email) {
          if (!emailPattern.test(email)) throw new Error('invalid Email');
          data.email = email;
        }
        const first = row.get('First Name');
        const last = row.get('Last Name');
        if (first) data.firstName = first;
        if (last) data.lastName = last;
        for (const [header, field] of TEXT_FIELDS) {
          const v = row.get(header);
          if (v === undefined || v === '') continue;
          data[field] = isClear(v) ? null : v;
        }

        const status = (row.get('Status') || '').toUpperCase();
        if (status) {
          if (!(Object.values(UserStatus) as string[]).includes(status)) throw new Error(`invalid Status "${status}"`);
          data.status = status;
        }
        const roleText = row.get('Role');
        if (roleText) {
          // Same role as the user already has (role records are lower-case, the legacy enum upper-case): nothing to do.
          const currentRole = String(user.roleRel?.name || user.role).toLowerCase();
          if (roleText.toLowerCase() !== currentRole) {
            const role = roleByKey.get(roleText.toLowerCase());
            const enumValue = (Object.values(UserRole) as string[]).find((r) => r.toLowerCase() === roleText.toLowerCase());
            if (role) {
              data.roleId = role.id;
              // The legacy enum follows the role when it is one of the built-in ones.
              const builtIn = (Object.values(UserRole) as string[]).find((r) => r.toLowerCase() === role.name.toLowerCase());
              if (builtIn) data.role = builtIn as UserRole;
            } else if (enumValue) {
              data.role = enumValue as UserRole;
              data.roleId = null;
            } else {
              throw new Error(`role "${roleText}" does not exist`);
            }
          }
        }

        // Skip the write when nothing actually differs from what is stored.
        const changed = Object.entries(data).some(([k, v]) => (user[k] ?? null) !== v);
        if (!changed) { unchanged++; continue; }
        await this.prisma.user.update({ where: { id: user.id }, data });
        updated++;
      } catch (err: any) {
        const msg = String(err?.message || 'Unknown error');
        errors.push(`Row ${row.rowNumber}: ${/Unique constraint/i.test(msg) ? 'that Email is already used by another user' : msg.split('\n').pop()}`);
      }
    }
    return { updated, unchanged, errors };
  }
}
