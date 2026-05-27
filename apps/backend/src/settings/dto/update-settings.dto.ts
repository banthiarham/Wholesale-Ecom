import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  siteName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tagline?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  faviconUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accentColor?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  headingFont?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bodyFont?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  headingFontSize?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bodyFontSize?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  heroBannerUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  heroHeadline?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  heroSubtext?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  heroCtaText?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  socialLinks?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  copyrightText?: string;
}