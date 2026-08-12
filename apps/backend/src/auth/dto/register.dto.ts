import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum, MinLength, IsNotEmpty, ValidateIf, Matches } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  /**
   * Customer signups: this property's validators are skipped entirely (ValidateIf false),
   * so any value or none passes — unchanged from the original @IsString()@IsOptional()
   * behavior. Dealer/B2B signups: doubles as "Mobile Number" and becomes required with a
   * strict 10-digit format.
   */
  @ApiPropertyOptional({ example: '+1234567890' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsNotEmpty({ message: 'Mobile Number is required for Dealer / B2B signup' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit mobile number' })
  phone?: string;

  /** Legacy enum role — still accepted for backward compatibility */
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.BUYER })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  /** Dynamic role ID — takes precedence over enum role when provided */
  @ApiPropertyOptional({ example: 'uuid-of-role' })
  @IsString()
  @IsOptional()
  roleId?: string;

  /** Referral code from another user (optional) */
  @ApiPropertyOptional({ example: 'JOHabc123' })
  @IsString()
  @IsOptional()
  referralCode?: string;

  /**
   * Which signup form was used — 'CUSTOMER' (default, quick signup) or 'DEALER' (the
   * Dealer / B2B form). Drives whether the Dealer/B2B-only fields below are required.
   * Purely a validation switch; it doesn't map to a User column.
   */
  @ApiPropertyOptional({ enum: ['CUSTOMER', 'DEALER'], default: 'CUSTOMER' })
  @IsEnum(['CUSTOMER', 'DEALER'])
  @IsOptional()
  accountCategory?: 'CUSTOMER' | 'DEALER';

  @ApiPropertyOptional({ example: 'Acme Traders Pvt Ltd' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsString()
  @IsNotEmpty({ message: 'Company Name is required for Dealer / B2B signup' })
  companyName?: string;

  @ApiPropertyOptional({ example: 'Acme Traders' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsString()
  @IsNotEmpty({ message: 'Organization Name is required for Dealer / B2B signup' })
  organizationName?: string;

  @ApiPropertyOptional({ example: '27ABCDE1234F1Z5' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsNotEmpty({ message: 'GSTIN is required for Dealer / B2B signup' })
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)',
  })
  gstin?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsNotEmpty({ message: 'PAN Number is required for Dealer / B2B signup' })
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Enter a valid 10-character PAN (e.g. ABCDE1234F)' })
  panNumber?: string;

  @ApiPropertyOptional({ example: 'Ramesh Kumar' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsString()
  @IsNotEmpty({ message: 'Contact Person Name is required for Dealer / B2B signup' })
  contactPersonName?: string;

  @ApiPropertyOptional({ example: '123 Industrial Area, Sector 5' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsString()
  @IsNotEmpty({ message: 'Full Address is required for Dealer / B2B signup' })
  companyAddress?: string;

  @ApiPropertyOptional({ example: '400001' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsNotEmpty({ message: 'Pincode is required for Dealer / B2B signup' })
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit pincode' })
  pincode?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsString()
  @IsNotEmpty({ message: 'City is required for Dealer / B2B signup' })
  city?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @ValidateIf((o) => o.accountCategory === 'DEALER')
  @IsString()
  @IsNotEmpty({ message: 'State is required for Dealer / B2B signup' })
  state?: string;
}
