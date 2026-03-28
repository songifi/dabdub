import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { firebaseConfig } from '../config';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface MulticastResult {
  successCount: number;
  failedTokens: string[];
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging!: admin.messaging.Messaging;

  constructor(
    @Inject(firebaseConfig.KEY)
    private readonly cfg: ConfigType<typeof firebaseConfig>,
  ) {}

  onModuleInit(): void {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(this.cfg.serviceAccount) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    this.messaging = admin.messaging();
    this.logger.log('Firebase Admin SDK initialized');
  }

  async sendMulticast(
    tokens: string[],
    payload: PushPayload,
  ): Promise<MulticastResult> {
    const response = await this.messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
    });

    const failedTokens: string[] = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        failedTokens.push(tokens[idx]);
      }
    });

    this.logger.log(
      `Multicast sent total=${tokens.length} success=${response.successCount} failed=${response.failureCount}`,
    );

    return { successCount: response.successCount, failedTokens };
  }
}
