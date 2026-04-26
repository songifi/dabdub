import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  /** 'smtp' uses SMTP credentials; 'sendgrid' uses SendGrid API key over SMTP */
  provider: (process.env['EMAIL_PROVIDER'] ?? 'smtp') as 'smtp' | 'sendgrid',

  // SMTP / SendGrid shared
  host: process.env['EMAIL_SMTP_HOST'] ?? 'smtp.sendgrid.net',
  port: parseInt(process.env['EMAIL_SMTP_PORT'] ?? '587', 10),
  secure: process.env['EMAIL_SMTP_SECURE'] === 'true',
  user: process.env['EMAIL_SMTP_USER'] ?? 'apikey', // SendGrid uses literal "apikey"
  pass: process.env['EMAIL_SMTP_PASS'] ?? '',       // SMTP password or SendGrid API key

  from: process.env['EMAIL_FROM'] ?? 'noreply@cheesepay.xyz',
  fromName: process.env['EMAIL_FROM_NAME'] ?? 'CheesePay',
}));

export type EmailConfig = ReturnType<typeof emailConfig>;
