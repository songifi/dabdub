import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { emailConfig } from '../config/email.config';

export interface MailSendResult {
  messageId: string;
}

// Resolves to src/email/templates in dev (ts-node) and dist/email/templates after build.
// nest-cli.json must include "assets": [{"include": "email/templates/**", "outDir": "dist"}]
const TEMPLATES_DIR = path.join(__dirname, 'templates');

const SUBJECTS: Record<string, string> = {
  welcome: 'Welcome to CheesePay',
  'payment-confirmed': 'Payment Confirmed',
  'settlement-completed': 'Settlement Completed',
  'payment-failed': 'Payment Failed',
  'analytics-report-ready': 'Your Analytics Report Is Ready',
};

@Injectable()
export class NodemailerService implements OnModuleInit {
  private readonly logger = new Logger(NodemailerService.name);
  private transporter!: nodemailer.Transporter;
  private layout!: Handlebars.TemplateDelegate;

  constructor(
    @Inject(emailConfig.KEY)
    private readonly cfg: ConfigType<typeof emailConfig>,
  ) {}

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: { user: this.cfg.user, pass: this.cfg.pass },
    });

    const layoutSrc = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'layout.hbs'),
      'utf8',
    );
    this.layout = Handlebars.compile(layoutSrc);
  }

  async send(
    to: string,
    templateAlias: string,
    mergeData: Record<string, unknown>,
  ): Promise<MailSendResult> {
    const { html, text } = this.renderTemplates(templateAlias, mergeData);
    const subject = (mergeData['subject'] as string | undefined) ?? SUBJECTS[templateAlias] ?? templateAlias;

    const info = await this.transporter.sendMail({
      from: `"${this.cfg.fromName}" <${this.cfg.from}>`,
      to,
      subject,
      html,
      text,
    });

    this.logger.log(`Email sent to=${to} template=${templateAlias} messageId=${info.messageId}`);
    return { messageId: info.messageId as string };
  }

  private renderTemplates(
    templateAlias: string,
    mergeData: Record<string, unknown>,
  ): { html: string; text: string } {
    const vars = { ...mergeData, year: new Date().getFullYear() };

    const htmlBodySrc = this.readTemplate(`${templateAlias}.html.hbs`);
    const textSrc = this.readTemplate(`${templateAlias}.text.hbs`);

    const htmlBody = Handlebars.compile(htmlBodySrc)(vars);
    const subject = (mergeData['subject'] as string | undefined) ?? SUBJECTS[templateAlias] ?? templateAlias;
    const html = this.layout({ ...vars, body: htmlBody, subject });
    const text = Handlebars.compile(textSrc)(vars);

    return { html, text };
  }

  private readTemplate(filename: string): string {
    const filePath = path.join(TEMPLATES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Email template not found: ${filename}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }
}
