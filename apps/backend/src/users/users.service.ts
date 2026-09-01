import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private excludePassword(user: User): Omit<User, 'password'> {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // If roleId provided, it must resolve to a real Role; derive the authoritative
    // enum role from it so `role` and `roleId` never diverge (mirrors auth.service.ts::register).
    // Dynamic roles beyond the legacy UserRole enum (e.g. Dealer, Wholesaler) can't be
    // written to the `role` column — leave it at its previous value for those and rely
    // on `roleId`/`roleRel` as the authoritative source, as done everywhere else.
    let roleEnum = createUserDto.role;
    const roleId = createUserDto.roleId;
    if (roleId) {
      const roleRecord = await this.prisma.role.findUnique({ where: { id: roleId } });
      if (!roleRecord) {
        throw new BadRequestException('Invalid role selected');
      }
      if ((Object.values(UserRole) as string[]).includes(roleRecord.name)) {
        roleEnum = roleRecord.name as UserRole;
      }
    }

    const hashedPassword = createUserDto.password
      ? await bcrypt.hash(createUserDto.password, 10)
      : undefined;

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        role: roleEnum,
        roleId: roleId || null,
        password: hashedPassword,
      },
    });

    return this.excludePassword(user);
  }

  async bulkUpload(fileBuffer: Buffer): Promise<{ created: number; skipped: number; errors: string[] }> {
    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
    } catch {
      throw new BadRequestException('Unable to read the uploaded CSV or Excel file');
    }

    if (!rows.length) throw new BadRequestException('The uploaded file has no user rows');
    if (rows.length > 1000) throw new BadRequestException('A maximum of 1000 users can be imported at once');

    const errors: string[] = [];
    let created = 0;
    let skipped = 0;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const roles = await this.prisma.role.findMany();
    const seenEmails = new Set<string>();
    const buyerRole = roles.find((role) => role.name === UserRole.BUYER);

    for (const [index, raw] of rows.entries()) {
      const rowNumber = index + 2;
      const normalized = new Map(
        Object.entries(raw).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]),
      );
      const get = (key: string) => String(normalized.get(key.toLowerCase().replace(/[^a-z0-9]/g, '')) ?? '').trim();
      const email = (get('Email') || (emailPattern.test(get('Username')) ? get('Username') : '')).toLowerCase();
      const fullName = get('Name');
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = nameParts.shift() || '';
      const lastName = nameParts.join(' ');
      const city = get('City');
      const region = get('Region');
      const postalCode = get('Postal Code');
      const country = get('Country / Region');
      const signUp = get('Sign Up');
      const lastActive = get('Last Active');
      const parseDate = (value: string): Date | undefined => {
        if (!value) return undefined;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
      };

      if (!email || !emailPattern.test(email)) {
        errors.push(`Row ${rowNumber}: valid email is required`); skipped++; continue;
      }
      if (seenEmails.has(email)) {
        errors.push(`Row ${rowNumber}: duplicate email in file (${email})`); skipped++; continue;
      }
      seenEmails.add(email);
      if (!firstName) {
        errors.push(`Row ${rowNumber}: Name is required`); skipped++; continue;
      }

      const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (exists) {
        errors.push(`Row ${rowNumber}: email already exists (${email})`); skipped++; continue;
      }

      try {
        await this.prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            // WooCommerce exports do not contain passwords. Generate an unknowable
            // credential; imported customers can use the existing Forgot Password flow.
            password: await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10),
            role: UserRole.BUYER,
            roleId: buyerRole?.id || null,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            city: city || null,
            state: region || null,
            pincode: postalCode || null,
            companyAddress: [city, region, postalCode, country].filter(Boolean).join(', ') || null,
            createdAt: parseDate(signUp),
            lastLoginAt: parseDate(lastActive),
          },
        });
        created++;
      } catch {
        errors.push(`Row ${rowNumber}: failed to create ${email}`); skipped++;
      }
    }

    return { created, skipped, errors };
  }

  async findAll(params?: {
    role?: UserRole;
    status?: UserStatus;
    skip?: number;
    take?: number;
  }): Promise<{ users: Omit<User, 'password'>[]; total: number }> {
    const { role, status, skip = 0, take = 20 } = params || {};

    const where = {
      ...(role && { role }),
      ...(status && { status }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users.map((u) => this.excludePassword(u)), total };
  }

  async findOne(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roleRel: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.excludePassword(user) : null;
  }

  async findByGoogleId(googleId: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({ where: { googleId } });
    return user ? this.excludePassword(user) : null;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    await this.prisma.user.findUnique({ where: { id } });

    const data: any = { ...updateUserDto };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.excludePassword(user);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
    });
    return this.excludePassword(user);
  }

  async updateRole(id: string, role: UserRole): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    return this.excludePassword(user);
  }

  async assignRole(id: string, roleId: string): Promise<Omit<User, 'password'>> {
    // Verify the role exists
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Update both roleId (dynamic) and role (enum) for dual-read compatibility.
    // Dynamic roles beyond the legacy UserRole enum can't be written to the `role`
    // column — leave it untouched for those and rely on roleId/roleRel instead.
    const isCoreRole = (Object.values(UserRole) as string[]).includes(role.name);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        roleId,
        ...(isCoreRole ? { role: role.name as UserRole } : {}),
      },
      include: { roleRel: true },
    });
    return this.excludePassword(user);
  }

  // Addresses
  async findAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createAddress(userId: string, data: { label?: string; street: string; city: string; state: string; zip: string; country?: string; isDefault?: boolean }) {
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: { ...data, userId },
    });
  }

  async updateAddress(userId: string, addressId: string, data: { label?: string; street?: string; city?: string; state?: string; zip?: string; country?: string; isDefault?: boolean }) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');

    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');
    await this.prisma.address.delete({ where: { id: addressId } });
    return { message: 'Address deleted' };
  }
}
