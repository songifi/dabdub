import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { zeptoConfig } from '../config';

export interface ZeptoSendResult {
  messageId: string;
}

@Injectable()
export class ZeptoMailService {
  private readonly logger = new Logger(ZeptoMailService.name);
  private readonly apiUrl = 'https://api.zeptomail.com/v1.1/email/template';

  constructor(
    @Inject(zeptoConfig.KEY)
    private readonly cfg: ConfigType<typeof zeptoConfig>,
  ) {}

  async send(
    to: string,
    templateAlias: string,
    mergeData: Record<string, unknown>,
  ): Promise<ZeptoSendResult> {
    const body = {
      mail_template_key: templateAlias,
      from: { address: this.cfg.fromEmail },
      to: [{ email_address: { address: to } }],
      merge_info: mergeData,
    };

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ZeptoMail ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { data?: Array<{ message_id?: string }> };
    const messageId = data?.data?.[0]?.message_id ?? 'unknown';
    this.logger.log(`Email sent to=${to} template=${templateAlias} messageId=${messageId}`);
    return { messageId };
  }
}
