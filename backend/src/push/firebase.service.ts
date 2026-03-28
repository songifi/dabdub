import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as webPush from 'web-push';
import { firebaseConfig, webPushConfig } from '../config';
import { DevicePlatform, type DeviceToken } from './entities/device-token.entity';

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
    @Inject(webPushConfig.KEY)
    private readonly webPushCfg: ConfigType<typeof webPushConfig>,
  ) {}

  onModuleInit(): void {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(this.cfg.serviceAccount) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    this.messaging = admin.messaging();
    webPush.setVapidDetails(
      this.webPushCfg.subject,
      this.webPushCfg.publicKey,
      this.webPushCfg.privateKey,
    );
    this.logger.log('Firebase Admin SDK initialized');
  }

  async sendToDevices(
    devices: DeviceToken[],
    payload: PushPayload,
  ): Promise<MulticastResult> {
    const failedTokens: string[] = [];
    const webDevices = devices.filter((device) => device.platform === DevicePlatform.WEB);
    const nativeDevices = devices.filter((device) => device.platform !== DevicePlatform.WEB);
    let successCount = 0;

    if (nativeDevices.length) {
      const nativeTokens = nativeDevices.map((device) => device.token);
      const response = await this.messaging.sendEachForMulticast({
        tokens: nativeTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ?? {},
      });

      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(nativeTokens[idx]);
        }
      });

      successCount += response.successCount;
      this.logger.log(
        `FCM multicast sent total=${nativeTokens.length} success=${response.successCount} failed=${response.failureCount}`,
      );
    }

    if (webDevices.length) {
      const webResults = await Promise.all(
        webDevices.map(async (device) => {
          if (!device.subscription) {
            failedTokens.push(device.token);
            return false;
          }

          try {
            await webPush.sendNotification(
              device.subscription,
              JSON.stringify({
                title: payload.title,
                body: payload.body,
                data: payload.data ?? {},
              }),
            );
            return true;
          } catch (error: unknown) {
            const statusCode =
              typeof error === 'object' && error !== null && 'statusCode' in error
                ? Number((error as { statusCode?: number }).statusCode)
                : undefined;

            if (statusCode === 404 || statusCode === 410) {
              failedTokens.push(device.token);
            }

            this.logger.warn(`Web push failed for endpoint=${device.token}`);
            return false;
          }
        }),
      );

      const webSuccessCount = webResults.filter(Boolean).length;
      successCount += webSuccessCount;
      this.logger.log(
        `Web push sent total=${webDevices.length} success=${webSuccessCount} failed=${webDevices.length - webSuccessCount}`,
      );
    }

    return { successCount, failedTokens };
  }
}
