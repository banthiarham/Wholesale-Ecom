import { User as PrismaUser, UserRole, UserStatus, AccountType } from '@prisma/client';

export class UserEntity implements PrismaUser {
  id: string;
  email: string;
  password: string | null;
  avatar: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  roleId: string | null;
  status: UserStatus;
  accountType: AccountType;
  googleId: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  companyName: string | null;
  companyAddress: string | null;
  taxId: string | null;
  referralCode: string | null;
  referredBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}
