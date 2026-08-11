import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SmtpSettingsService, DecryptedSmtpConfig } from '../smtp-settings/smtp-settings.service';

@Injectable()
export class EmailService {
  constructor(
    private configService: ConfigService,
    private smtpSettingsService: SmtpSettingsService,
  ) {}

  /**
   * Resolves the SMTP config to send with. Admin-configured DB settings (managed via the
   * Email/SMTP Settings admin page) always win when present; otherwise falls back to the
   * SMTP_* env vars (e.g. the Ethereal dev config) so the OTP flow keeps working either way.
   * Resolved fresh on every send (not cached) so a settings change takes effect immediately.
   */
  private async resolveConfig(): Promise<DecryptedSmtpConfig | null> {
    const dbConfig = await this.smtpSettingsService.getActiveDecryptedConfig();
    if (dbConfig) return dbConfig;

    const host = this.configService.get<string>('SMTP_HOST', '');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');
    if (!host || !user || !pass) return null;

    const from = this.configService.get<string>('SMTP_FROM', 'WholesaleX Pro <noreply@wholesalex.com>');
    const fromMatch = from.match(/^"?([^"<]*)"?\s*<(.+)>$/);
    return {
      host,
      port: Number(port),
      username: user,
      password: pass,
      fromName: fromMatch ? fromMatch[1].trim() : 'WholesaleX Pro',
      fromEmail: fromMatch ? fromMatch[2].trim() : from,
    };
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const config = await this.resolveConfig();
    if (!config) {
      console.warn('Email not configured. Skipping email send.');
      return;
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.username, pass: config.password },
    });
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
    });
  }

  async sendNotificationEmail(to: string, title: string, message: string): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">${title}</h2>
        <p>${message}</p>
        <hr/>
        <p style="font-size:12px;color:#666;">WholesaleX Pro — B2B Wholesale Platform</p>
      </div>
    `;
    await this.sendEmail(to, title, html);
  }

  async sendOrderConfirmation(to: string, orderNumber: string, total: number): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Order Confirmed</h2>
        <p>Your order <strong>#${orderNumber}</strong> has been placed successfully.</p>
        <p>Total: <strong>₹${total.toLocaleString('en-IN')}</strong></p>
        <hr/>
        <p style="font-size:12px;color:#666;">WholesaleX Pro — B2B Wholesale Platform</p>
      </div>
    `;
    await this.sendEmail(to, `Order #${orderNumber} Confirmed`, html);
  }

  async sendBulkOrderDecisionEmail(to: string, bulkOrderNumber: string, status: string, comment?: string | null): Promise<void> {
    const decisionText = status === 'ACCEPTED' ? 'accepted' : 'rejected';
    const color = status === 'ACCEPTED' ? '#16a34a' : '#dc2626';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:${color};">Bulk Order Request ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}</h2>
        <p>Your bulk order request <strong>#${bulkOrderNumber}</strong> has been ${decisionText} by our team.</p>
        ${comment ? `<p><strong>Admin note:</strong> ${comment}</p>` : ''}
        <hr/>
        <p style="font-size:12px;color:#666;">WholesaleX Pro — B2B Wholesale Platform</p>
      </div>
    `;
    await this.sendEmail(to, `Bulk Order #${bulkOrderNumber} ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`, html);
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Email Verification</h2>
        <p>Your OTP code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;">${otp}</div>
        <p>This code expires in 10 minutes.</p>
        <hr/>
        <p style="font-size:12px;color:#666;">WholesaleX Pro — B2B Wholesale Platform</p>
      </div>
    `;
    await this.sendEmail(to, 'Your OTP Code', html);
  }

  async isConfigured(): Promise<boolean> {
    return (await this.resolveConfig()) !== null;
  }
}
