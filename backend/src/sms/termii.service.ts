import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { smsConfig } from '../config';

export interface TermiiSendResult {
  messageId: string;
}

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);
  private readonly apiUrl = 'https://api.ng.termii.com/api/sms/send';

  constructor(
    @Inject(smsConfig.KEY)
    private readonly cfg: ConfigType<typeof smsConfig>,
  ) {}

  async send(phone: string, message: string): Promise<TermiiSendResult> {
    const body = {
      api_key: this.cfg.termiiApiKey,
      to: phone,
      from: this.cfg.termiiSenderId,
      sms: message,
      type: 'plain',
      channel: 'generic',
    };

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Termii ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { message_id?: string };
    const messageId = data?.message_id ?? 'unknown';

    this.logger.log(`SMS sent to=${phone} messageId=${messageId}`);
    return { messageId };
  }
}
