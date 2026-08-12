import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus, AccountType } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty()
  role: UserRole;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  accountType: AccountType;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  phoneVerified: boolean;

  @ApiProperty({ nullable: true })
  companyName: string | null;

  @ApiProperty({ nullable: true })
  companyAddress: string | null;

  @ApiProperty({ nullable: true })
  taxId: string | null;

  @ApiProperty({ nullable: true })
  organizationName: string | null;

  @ApiProperty({ nullable: true })
  gstin: string | null;

  @ApiProperty({ nullable: true })
  panNumber: string | null;

  @ApiProperty({ nullable: true })
  contactPersonName: string | null;

  @ApiProperty({ nullable: true })
  pincode: string | null;

  @ApiProperty({ nullable: true })
  city: string | null;

  @ApiProperty({ nullable: true })
  state: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  lastLoginAt: Date | null;
}
