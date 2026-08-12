import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { SmtpSettingsService, DecryptedSmtpConfig } from '../smtp-settings/smtp-settings.service';

const BRAND_FOOTER = 'WholesaleX Pro — B2B Wholesale Platform';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

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
    const fromName = fromMatch ? fromMatch[1].trim() : 'WholesaleX Pro';
    const fromEmail = fromMatch ? fromMatch[2].trim() : from;
    const replyToEmail = this.configService.get<string>('SMTP_REPLY_TO', '') || fromEmail;

    return {
      host,
      port: Number(port),
      username: user,
      password: pass,
      fromName,
      fromEmail,
      replyToEmail,
    };
  }

  /**
   * Sends a message and only reports it as sent when the SMTP server actually confirmed
   * accepting a recipient — a resolved sendMail() promise alone can still carry a rejected
   * recipient, so that case must not be treated as success either.
   *
   * `text` is always sent alongside `html` (multipart/alternative): HTML-only mail with no
   * plain-text part is one of the most common spam-filter signals for transactional email.
   */
  async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    const config = await this.resolveConfig();
    if (!config) {
      this.logger.warn('Email not configured. Skipping email send.');
      return;
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.username, pass: config.password },
    });

    const domain = config.fromEmail.split('@')[1] || config.host;
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      replyTo: `"${config.fromName}" <${config.replyToEmail}>`,
      to,
      subject,
      text,
      html,
      // A Message-ID host that matches the From domain is expected by many receiving MTAs;
      // nodemailer otherwise defaults to the local machine's hostname, which doesn't.
      messageId: `<${randomUUID()}@${domain}>`,
    });

    if (!info.accepted || !info.accepted.includes(to)) {
      throw new Error(
        `SMTP server did not accept ${to} for delivery` +
          (info.rejected?.length ? ` (rejected: ${info.rejected.join(', ')})` : ''),
      );
    }
  }

  async sendNotificationEmail(to: string, title: string, message: string): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">${title}</h2>
        <p>${message}</p>
        <hr/>
        <p style="font-size:12px;color:#666;">${BRAND_FOOTER}</p>
      </div>
    `;
    const text = `${title}\n\n${message}\n\n${BRAND_FOOTER}`;
    await this.sendEmail(to, title, html, text);
  }

  async sendOrderConfirmation(to: string, orderNumber: string, total: number): Promise<void> {
    const formattedTotal = total.toLocaleString('en-IN');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Order Confirmed</h2>
        <p>Your order <strong>#${orderNumber}</strong> has been placed successfully.</p>
        <p>Total: <strong>₹${formattedTotal}</strong></p>
        <hr/>
        <p style="font-size:12px;color:#666;">${BRAND_FOOTER}</p>
      </div>
    `;
    const text =
      `Order Confirmed\n\n` +
      `Your order #${orderNumber} has been placed successfully.\n` +
      `Total: ₹${formattedTotal}\n\n${BRAND_FOOTER}`;
    await this.sendEmail(to, `Order #${orderNumber} Confirmed`, html, text);
  }

  async sendBulkOrderDecisionEmail(to: string, bulkOrderNumber: string, status: string, comment?: string | null): Promise<void> {
    const decisionText = status === 'ACCEPTED' ? 'accepted' : 'rejected';
    const color = status === 'ACCEPTED' ? '#16a34a' : '#dc2626';
    const heading = `Bulk Order Request ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:${color};">${heading}</h2>
        <p>Your bulk order request <strong>#${bulkOrderNumber}</strong> has been ${decisionText} by our team.</p>
        ${comment ? `<p><strong>Admin note:</strong> ${comment}</p>` : ''}
        <hr/>
        <p style="font-size:12px;color:#666;">${BRAND_FOOTER}</p>
      </div>
    `;
    const text =
      `${heading}\n\n` +
      `Your bulk order request #${bulkOrderNumber} has been ${decisionText} by our team.\n` +
      (comment ? `Admin note: ${comment}\n` : '') +
      `\n${BRAND_FOOTER}`;
    await this.sendEmail(to, `Bulk Order #${bulkOrderNumber} ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`, html, text);
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Email Verification</h2>
        <p>Use the code below to verify your email address and finish signing up for WholesaleX Pro.</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;">${otp}</div>
        <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        <hr/>
        <p style="font-size:12px;color:#666;">${BRAND_FOOTER}</p>
      </div>
    `;
    const text =
      `Email Verification\n\n` +
      `Use the code below to verify your email address and finish signing up for WholesaleX Pro.\n\n` +
      `${otp}\n\n` +
      `This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n` +
      `${BRAND_FOOTER}`;
    await this.sendEmail(to, 'Your OTP Code', html, text);
  }

  async isConfigured(): Promise<boolean> {
    return (await this.resolveConfig()) !== null;
  }
}
