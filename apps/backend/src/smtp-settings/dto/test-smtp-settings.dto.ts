import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpsertSmtpSettingsDto } from './upsert-smtp-settings.dto';

export class TestSmtpSettingsDto extends UpsertSmtpSettingsDto {
  @ApiProperty({ description: 'Address to send the test email to', example: 'admin@example.com' })
  @IsEmail()
  to: string;
}
