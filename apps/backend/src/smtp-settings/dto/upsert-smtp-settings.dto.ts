import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertSmtpSettingsDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ example: 587 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ example: 'you@example.com' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({ description: 'Omit or leave blank to keep the currently saved password unchanged' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ example: 'WholesaleX Pro' })
  @IsString()
  @IsNotEmpty()
  fromName: string;

  @ApiProperty({ example: 'noreply@wholesalex.com' })
  @IsEmail()
  fromEmail: string;

  @ApiPropertyOptional({
    description: 'Monitored inbox for the Reply-To header. Defaults to fromEmail if omitted — but a noreply From with no separate Reply-To is a common spam signal, so a monitored address (e.g. support@yourdomain.com) is recommended.',
    example: 'support@wholesalex.com',
  })
  @IsOptional()
  @IsEmail()
  replyToEmail?: string;
}
