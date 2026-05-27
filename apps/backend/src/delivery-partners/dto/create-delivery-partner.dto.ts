import { IsString, IsOptional, IsBoolean, IsObject, IsArray, ValidateNested } from 'class-validator';
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

export class CreateDeliveryPartnerDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trackingUrlTemplate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  @ApiProperty({ type: 'object', required: false })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Custom credential field definitions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialFieldDto)
  credentialFields?: CredentialFieldDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}