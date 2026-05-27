import { IsString, IsBoolean, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class CredentialFieldDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsBoolean()
  required: boolean;
}

export class CreateGatewayDto {
  @ApiProperty({ description: 'Provider name (e.g. RAZORPAY, CCAVENUE, STRIPE, PAYU, or custom)' })
  @IsString()
  provider: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @IsBoolean()
  isDefault: boolean;

  @ApiProperty()
  @IsBoolean()
  testMode: boolean;

  @ApiProperty({ type: 'object' })
  @IsObject()
  credentials: Record<string, string>;

  @ApiPropertyOptional({ description: 'Custom credential field definitions for custom gateways' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialFieldDto)
  credentialFields?: CredentialFieldDto[];

  @ApiPropertyOptional({ description: 'Gateway redirect URL for custom providers' })
  @IsOptional()
  @IsString()
  gatewayUrl?: string;

  @ApiPropertyOptional({ description: 'Webhook/callback URL for custom providers' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}