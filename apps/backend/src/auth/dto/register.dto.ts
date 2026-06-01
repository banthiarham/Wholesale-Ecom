import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum, MinLength, IsNotEmpty } from 'class-validator';
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

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsString()
  @IsOptional()
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
}