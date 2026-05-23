import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', '');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      console.warn('Email not configured. Skipping email send.');
      return;
    }
    const from = this.configService.get<string>('SMTP_FROM', 'noreply@wholesalex.com');
    await this.transporter.sendMail({ from, to, subject, html });
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

  isConfigured(): boolean {
    return !!this.transporter;
  }
}
