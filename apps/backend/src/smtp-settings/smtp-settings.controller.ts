import { Body, Controller, Get, Put, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SmtpSettingsService } from './smtp-settings.service';
import { UpsertSmtpSettingsDto } from './dto/upsert-smtp-settings.dto';
import { TestSmtpSettingsDto } from './dto/test-smtp-settings.dto';

@ApiTags('SMTP Settings')
@Controller('smtp-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class SmtpSettingsController {
  constructor(private readonly service: SmtpSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current SMTP settings (admin) — password is never returned' })
  async get() {
    const settings = await this.service.getSettings();
    return { settings };
  }

  @Put()
  @ApiOperation({ summary: 'Create or update SMTP settings (admin)' })
  async upsert(@Body() dto: UpsertSmtpSettingsDto) {
    const settings = await this.service.upsert(dto);
    return { settings };
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Send a test email using the given (or saved) SMTP settings (admin)' })
  async testEmail(@Body() dto: TestSmtpSettingsDto) {
    return this.service.testEmail(dto);
  }
}
