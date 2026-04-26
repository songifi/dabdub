import { Injectable, Logger } from "@nestjs/common";
import { Processor, Process, OnQueueFailed } from "@nestjs/bull";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import * as sgMail from "@sendgrid/mail";
import {
  EMAIL_DELIVERY_JOB,
  EMAIL_DELIVERY_QUEUE,
} from "../queue/queue.constants";
import { EmailDeliveryLog } from "./entities/email-delivery-log.entity";

interface EmailJobPayload {
  recipient: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
@Processor(EMAIL_DELIVERY_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(EmailDeliveryLog)
    private readonly emailLogRepo: Repository<EmailDeliveryLog>,
    private readonly configService: ConfigService,
  ) {
    const sendGridKey = this.configService.get<string>("SENDGRID_API_KEY");
    if (sendGridKey) {
      sgMail.setApiKey(sendGridKey);
    }
  }

  @Process(EMAIL_DELIVERY_JOB)
  async process(job: Job<EmailJobPayload>): Promise<void> {
    const payload = job.data;
    const attemptNumber = job.attemptsMade + 1;

    try {
      await this.sendEmail(payload);
      await this.logEmail(
        payload.recipient,
        payload.subject,
        attemptNumber,
        "success",
      );
    } catch (error) {
      const errorMessage =
        error?.message ?? JSON.stringify(error) ?? "Unknown email error";
      await this.logEmail(
        payload.recipient,
        payload.subject,
        attemptNumber,
        "failure",
        errorMessage,
      );
      this.logger.warn(
        `Email job failed for ${payload.recipient} attempt ${attemptNumber}: ${errorMessage}`,
      );
      throw error;
    }
  }

  @OnQueueFailed()
  async handleExhausted(job: Job<EmailJobPayload>, err: Error): Promise<void> {
    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 2);
    if (!isExhausted) return;

    this.logger.error(
      `Email permanently failed for ${job.data.recipient} after ${job.attemptsMade} attempt(s): ${err.message}`,
      err.stack,
    );

    await this.logEmail(
      job.data.recipient,
      job.data.subject,
      job.attemptsMade,
      'failure',
      `EXHAUSTED: ${err.message}`,
    );
  }

  private async sendEmail(payload: EmailJobPayload) {
    const from =
      this.configService.get<string>("EMAIL_FROM") ||
      this.configService.get<string>("SMTP_FROM") ||
      `no-reply@${this.configService.get<string>("EMAIL_DOMAIN", "cheesepay.local")}`;

    const sendGridKey = this.configService.get<string>("SENDGRID_API_KEY");
    if (sendGridKey) {
      await sgMail.send({
        to: payload.recipient,
        from,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      return;
    }

    const host = this.configService.get<string>("SMTP_HOST");
    const port = Number(this.configService.get<number>("SMTP_PORT", 587));
    const secure =
      this.configService.get<string>("SMTP_SECURE", "false") === "true";
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");

    if (!host || !user || !pass) {
      throw new Error("SMTP configuration is incomplete");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: payload.recipient,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }

  private async logEmail(
    recipient: string,
    subject: string,
    attemptNumber: number,
    status: "success" | "failure",
    error?: string,
  ) {
    const entry = this.emailLogRepo.create({
      recipient,
      subject,
      attemptNumber,
      status,
      error,
    });
    await this.emailLogRepo.save(entry);
  }
}
