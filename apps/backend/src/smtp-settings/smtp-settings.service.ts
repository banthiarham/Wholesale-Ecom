import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSmtpSettingsDto } from './dto/upsert-smtp-settings.dto';
import { TestSmtpSettingsDto } from './dto/test-smtp-settings.dto';

export interface DecryptedSmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

@Injectable()
export class SmtpSettingsService {
  private encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Same encrypt-at-rest pattern as PaymentGatewaysService, but with its own key so
    // rotating one doesn't affect the other's stored secrets.
    this.encryptionKey = this.configService.get<string>(
      'SMTP_CREDENTIALS_KEY',
      'default-smtp-encryption-key-change-in-production',
    );
  }

  private encrypt(value: string): string {
    return CryptoJS.AES.encrypt(value, this.encryptionKey).toString();
  }

  private decrypt(value: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(value, this.encryptionKey);
      const plain = bytes.toString(CryptoJS.enc.Utf8);
      if (!plain) throw new Error('empty');
      return plain;
    } catch {
      throw new BadRequestException('Failed to decrypt SMTP password. Check SMTP_CREDENTIALS_KEY.');
    }
  }

  private async getRow() {
    // Singleton: only one SMTP config is ever in effect, so always operate on the
    // earliest-created row regardless of how many might exist.
    return this.prisma.smtpSettings.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  /** Admin-facing read — password is NEVER included, only whether one is set. */
  async getSettings() {
    const row = await this.getRow();
    if (!row) return null;
    const { passwordEncrypted: _passwordEncrypted, ...rest } = row;
    return { ...rest, hasPassword: !!row.passwordEncrypted };
  }

  /** Internal-only — used by EmailService to actually send mail. Never exposed via a controller. */
  async getActiveDecryptedConfig(): Promise<DecryptedSmtpConfig | null> {
    const row = await this.prisma.smtpSettings.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!row || !row.passwordEncrypted) return null;
    return {
      host: row.host,
      port: row.port,
      username: row.username,
      password: this.decrypt(row.passwordEncrypted),
      fromName: row.fromName,
      fromEmail: row.fromEmail,
    };
  }

  async upsert(dto: UpsertSmtpSettingsDto) {
    const existing = await this.getRow();
    let passwordEncrypted = existing?.passwordEncrypted;
    if (dto.password && dto.password.trim()) {
      passwordEncrypted = this.encrypt(dto.password.trim());
    }
    if (!passwordEncrypted) {
      throw new BadRequestException('SMTP password is required for initial setup');
    }

    const data = {
      host: dto.host.trim(),
      port: dto.port,
      username: dto.username.trim(),
      passwordEncrypted,
      fromName: dto.fromName.trim(),
      fromEmail: dto.fromEmail.trim(),
      isActive: true,
    };

    const saved = existing
      ? await this.prisma.smtpSettings.update({ where: { id: existing.id }, data })
      : await this.prisma.smtpSettings.create({ data });

    const { passwordEncrypted: _passwordEncrypted, ...rest } = saved;
    return { ...rest, hasPassword: true };
  }

  /**
   * Resolves the password to test with: the admin can test a freshly-typed password
   * before saving, or — since the saved password is never sent back to the UI — leave
   * the field blank to reuse whatever is already stored.
   */
  private async resolveTestPassword(providedPassword?: string): Promise<string> {
    if (providedPassword && providedPassword.trim()) return providedPassword.trim();
    const existing = await this.getRow();
    if (existing?.passwordEncrypted) return this.decrypt(existing.passwordEncrypted);
    throw new BadRequestException('SMTP password is required to send a test email');
  }

  async testEmail(dto: TestSmtpSettingsDto): Promise<{ success: boolean; message: string }> {
    const password = await this.resolveTestPassword(dto.password);
    const transporter = nodemailer.createTransport({
      host: dto.host.trim(),
      port: dto.port,
      secure: dto.port === 465,
      auth: { user: dto.username.trim(), pass: password },
    });

    try {
      await transporter.verify();
      await transporter.sendMail({
        from: `"${dto.fromName.trim()}" <${dto.fromEmail.trim()}>`,
        to: dto.to.trim(),
        subject: 'WholesaleX Pro — SMTP Test Email',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
            <h2 style="color:#2563eb;">SMTP Test Successful</h2>
            <p>This is a test email confirming your SMTP configuration is working correctly.</p>
            <hr/>
            <p style="font-size:12px;color:#666;">WholesaleX Pro — B2B Wholesale Platform</p>
          </div>
        `,
      });
      return { success: true, message: `Test email sent successfully to ${dto.to}` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to send test email. Check your SMTP configuration.' };
    }
  }
}
