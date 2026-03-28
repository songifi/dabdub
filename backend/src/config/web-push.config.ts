import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export const webPushConfig = registerAs(
  'webPush',
  (): WebPushConfig => ({
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
    subject: process.env.VAPID_SUBJECT ?? 'mailto:support@cheesepay.app',
  }),
);

export const webPushConfigValidation = {
  VAPID_PUBLIC_KEY: Joi.string().required(),
  VAPID_PRIVATE_KEY: Joi.string().required(),
  VAPID_SUBJECT: Joi.string().uri({ scheme: [/https?/, 'mailto'] }).optional(),
};
