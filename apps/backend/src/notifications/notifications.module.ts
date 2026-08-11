import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SmtpSettingsModule } from '../smtp-settings/smtp-settings.module';

@Module({
  imports: [PrismaModule, SmtpSettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
